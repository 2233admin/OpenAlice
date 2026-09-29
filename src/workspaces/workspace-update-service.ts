import { readUpdatePreferences, type UpdatePreferences } from '../core/update-preferences.js'
import { readHarnessSource } from './harness-source.js'
import type { WorkspaceService } from './service.js'

const CHECK_INTERVAL_MS = 60 * 60_000
const SOURCE_TEMPLATES = {
  'auto-quant-v2': 'autoUpdateAutoQuant',
  'auto-prediction': 'autoUpdateAutoPrediction',
} as const satisfies Record<string, keyof UpdatePreferences>

type Phase = 'checking' | 'available' | 'applying' | 'current' | 'updated' | 'blocked' | 'failed'
export interface WorkspaceUpdateState {
  readonly workspaceId: string
  readonly template: keyof typeof SOURCE_TEMPLATES
  readonly phase: Phase
  readonly checkedAt: string | null
  readonly fromVersion?: string
  readonly toVersion?: string
  readonly verified?: boolean
  readonly reason?: string
}

/** Project-local command boundary. Checking only observes source metadata;
 * policy application is a separate serialized command. The source manager
 * retains exact-target, Git/activity, compatibility and recovery authority. */
export class WorkspaceUpdateService {
  private readonly states = new Map<string, WorkspaceUpdateState>()
  private timer: ReturnType<typeof setInterval> | null = null
  private tail: Promise<void> = Promise.resolve()
  private checkFlight: Promise<void> | null = null
  private policyFlight: Promise<void> | null = null
  private stopped = false

  constructor(private readonly service: Pick<WorkspaceService, 'registry' | 'sourceUpgrades'>) {}

  list(): readonly WorkspaceUpdateState[] { return [...this.states.values()] }

  start(): void {
    if (this.timer) return
    this.stopped = false
    const cycle = () => { void this.refreshAndApplyPolicy().catch((error: unknown) => {
      console.warn('[workspace updates] Background policy failed:', error)
    }) }
    cycle()
    this.timer = setInterval(cycle, CHECK_INTERVAL_MS)
    this.timer.unref?.()
  }

  stop(): void {
    this.stopped = true
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  private enqueue(task: () => Promise<void>): Promise<void> {
    const run = this.tail.then(task)
    this.tail = run.catch(() => undefined)
    return run
  }

  check(): Promise<void> {
    if (this.checkFlight) return this.checkFlight
    const run = this.enqueue(() => this.scan()).finally(() => {
      if (this.checkFlight === run) this.checkFlight = null
    })
    this.checkFlight = run
    return run
  }

  applyPolicy(): Promise<void> {
    if (this.policyFlight) return this.policyFlight
    const run = this.enqueue(() => this.applyAvailable()).finally(() => {
      if (this.policyFlight === run) this.policyFlight = null
    })
    this.policyFlight = run
    return run
  }

  /** Automatic activation/timer and an explicit policy change use this command.
   * Manual check never calls it, even when automatic apply is enabled. */
  async refreshAndApplyPolicy(): Promise<void> {
    await this.check()
    if (!this.stopped) await this.applyPolicy()
  }

  private async scan(): Promise<void> {
    const workspaces = this.service.registry.list()
    const ids = new Set(workspaces.map(workspace => workspace.id))
    for (const id of this.states.keys()) if (!ids.has(id)) this.states.delete(id)
    for (const workspace of workspaces) {
      if (this.stopped) return
      if (!(workspace.template && workspace.template in SOURCE_TEMPLATES)) continue
      const template = workspace.template as keyof typeof SOURCE_TEMPLATES
      const prior = this.states.get(workspace.id)
      const base = { workspaceId: workspace.id, template }
      this.states.set(workspace.id, { ...prior, ...base, phase: 'checking', checkedAt: prior?.checkedAt ?? null })
      try {
        const receipt = await readHarnessSource(workspace.dir)
        if (!receipt) throw new Error('Workspace has no Harness source receipt')
        // Discovery is independent of apply policy. Stable upstream tags remain
        // visible (with verified=false outside the bundled catalog) when the
        // user disables automatic merges.
        const latest = await this.service.sourceUpgrades.latest(template, receipt.version, true)
        this.states.set(workspace.id, {
          ...base, checkedAt: new Date().toISOString(), fromVersion: receipt.version,
          ...(latest ? { phase: 'available', toVersion: latest.version, verified: latest.verified } : { phase: 'current' }),
        })
      } catch (error) {
        this.states.set(workspace.id, {
          ...prior, ...base, phase: 'failed', checkedAt: new Date().toISOString(),
          reason: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }

  private async applyAvailable(): Promise<void> {
    for (const state of this.states.values()) {
      if (this.stopped) return
      if (state.phase !== 'available' || !state.toVersion) continue
      // Read immediately before each mutation so a preference change during
      // another Workspace's merge cannot authorize the next one accidentally.
      const preferences = await readUpdatePreferences()
      if (!preferences[SOURCE_TEMPLATES[state.template]]) continue
      try {
        const plan = await this.service.sourceUpgrades.plan(state.workspaceId, true, state.toVersion)
        if (plan.blocked) {
          this.states.set(state.workspaceId, { ...state, phase: 'blocked', reason: plan.blockers.join(', ') })
          continue
        }
        if (this.stopped) return
        const currentPolicy = await readUpdatePreferences()
        if (!currentPolicy[SOURCE_TEMPLATES[state.template]]) continue
        this.states.set(state.workspaceId, { ...state, phase: 'applying' })
        await this.service.sourceUpgrades.apply(state.workspaceId, true, {
          planDigest: plan.planDigest, targetVersion: state.toVersion,
        })
        this.states.set(state.workspaceId, { ...state, phase: 'updated' })
      } catch (error) {
        this.states.set(state.workspaceId, { ...state, phase: 'failed',
          reason: error instanceof Error ? error.message : String(error) })
      }
    }
  }
}
