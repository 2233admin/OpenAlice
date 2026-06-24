/**
 * ScheduleScanner - the dumb external scheduler for workspace self-declared
 * tasks. Each tick it enumerates every workspace, reads that workspace's own
 * `.alice/schedule.json` live, and for every due task fires a headless run via
 * the workspace's automation interface. It interprets NOTHING about the work -
 * `what` is an opaque prompt handed straight to `dispatchHeadlessTask`.
 *
 * The ~1-min tick is the scheduler's OWN control loop (a plain timer), NOT a
 * scheduled task - infrastructure periodicity never enters the self-description
 * system. There is deliberately NO per-workspace lock: if a fire collides with a
 * still-running run or a live interactive session in the same checkout, the
 * coding agent absorbs it (it lives in multi-AI-on-one-repo all day). The only
 * bound is the global headless concurrency cap inside `dispatch`.
 *
 * Due-ness carries no external schedule state (see `fireBase`): from the last
 * fire, or a never-fired baseline — `every`/`at` from epoch (fire on first
 * sight), `cron` from `now - interval` (catches an occurrence that just passed,
 * without firing immediately on creation OR never firing at all — seeding cron
 * from `now` makes `computeNextRun` always strictly future, i.e. never due).
 * Then `computeNextRun(when, base) <= now`. The marker is written only AFTER a
 * successful dispatch, so a capacity-rejected `every`/`at` fire retries next
 * tick; a `cron` fire rejected at its exact occurrence may skip to the next
 * occurrence (rare — needs the pool full at that minute).
 */

import { computeNextRun } from '../../core/schedule-expr.js'
import type { CliAdapter } from '../cli-adapter.js'
import type { Logger } from '../logger.js'
import type { WorkspaceMeta, WorkspaceRegistry } from '../workspace-registry.js'

import {
  fireBase,
  readScheduleDeclaration,
  snapshotTask,
  taskWhen,
  type ScheduleSnapshot,
  type ScheduleSnapshotTask,
  type ScheduleSnapshotWorkspace,
} from './declaration.js'

export const DEFAULT_INTERVAL_MS = 60_000
/** Matches the legacy cron-router's headless dispatch timeout. */
const RUN_TIMEOUT_MS = 30 * 60_000

/** The slice of ScheduleMarkerStore the scanner needs (structural, for testing). */
export interface MarkerStore {
  key(wsId: string, taskId: string): string
  get(wsId: string, taskId: string): number | undefined
  set(wsId: string, taskId: string, ts: number): Promise<void>
  prune(seenKeys: Set<string>): Promise<void>
}

export interface ScheduleScannerDeps {
  registry: WorkspaceRegistry
  resolveAdapter: (meta: WorkspaceMeta, agentId?: string) => CliAdapter
  dispatch: (
    meta: WorkspaceMeta,
    adapter: CliAdapter,
    prompt: string,
    timeoutMs: number,
  ) => Promise<{ taskId: string }>
  markers: MarkerStore
  logger: Logger
  /** Injectable clock for tests. */
  now?: () => number
  /** Injectable tick interval for tests. */
  intervalMs?: number
}

export class ScheduleScanner {
  private timer: ReturnType<typeof setTimeout> | null = null
  private stopped = false
  private scanning = false
  /** Snapshot built as a side-effect of each scan; null until the first scan. */
  private lastSnapshot: ScheduleSnapshot | null = null
  private readonly now: () => number
  private readonly intervalMs: number

  constructor(private readonly deps: ScheduleScannerDeps) {
    this.now = deps.now ?? Date.now
    this.intervalMs = deps.intervalMs ?? DEFAULT_INTERVAL_MS
  }

  /** Begin ticking. First scan happens after one interval (never on construct). */
  start(): void {
    if (this.timer || this.stopped) return
    this.arm()
    this.deps.logger.info('schedule.scanner_started', { intervalMs: this.intervalMs })
  }

  stop(): void {
    this.stopped = true
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  /** The snapshot built by the last scan (warm cache for GET /api/schedule), or
   *  null before the first tick. The scanner already reads every declaration each
   *  tick, so this is free — the route serves it instead of re-walking disk. */
  snapshot(): ScheduleSnapshot | null {
    return this.lastSnapshot
  }

  private arm(): void {
    if (this.stopped) return
    this.timer = setTimeout(() => void this.tickAndRearm(), this.intervalMs)
    // Don't hold the event loop / a test runner open on the scheduler's timer.
    this.timer.unref?.()
  }

  private async tickAndRearm(): Promise<void> {
    this.timer = null
    if (this.stopped) return
    try {
      await this.scan()
    } catch (err) {
      this.deps.logger.warn('schedule.scan_failed', { err })
    }
    if (!this.stopped) this.arm()
  }

  /** One full pass over all workspaces. Public for tests / a future "scan now". */
  async scan(): Promise<void> {
    if (this.scanning) {
      this.deps.logger.info('schedule.scan_overlap_skipped', {})
      return
    }
    this.scanning = true
    const nowMs = this.now()
    const seen = new Set<string>()
    try {
      // registry.list() order is preserved by Promise.all → stable display order.
      const workspaces = await Promise.all(
        this.deps.registry.list().map((ws) => this.scanWorkspace(ws, nowMs, seen)),
      )
      await this.deps.markers.prune(seen)
      this.lastSnapshot = { workspaces }
    } finally {
      this.scanning = false
    }
  }

  /** Read one workspace's declaration, fire its due tasks, and return its
   *  snapshot row (includes disabled tasks, shown as off). Reads each
   *  declaration ONCE — firing and the dashboard view come from the same read. */
  private async scanWorkspace(
    ws: WorkspaceMeta,
    nowMs: number,
    seen: Set<string>,
  ): Promise<ScheduleSnapshotWorkspace> {
    let res
    try {
      res = await readScheduleDeclaration(ws.dir)
    } catch (err) {
      this.deps.logger.warn('schedule.read_failed', { wsId: ws.id, err })
      return { wsId: ws.id, tag: ws.tag, status: 'invalid', error: 'failed to read schedule file', tasks: [] }
    }
    if (!res.ok) {
      if (res.reason === 'invalid') {
        this.deps.logger.warn('schedule.declaration_invalid', { wsId: ws.id, error: res.error })
        return { wsId: ws.id, tag: ws.tag, status: 'invalid', error: res.error, tasks: [] }
      }
      return { wsId: ws.id, tag: ws.tag, status: 'absent', tasks: [] }
    }

    const tasks: ScheduleSnapshotTask[] = []
    for (const task of res.tasks) {
      seen.add(this.deps.markers.key(ws.id, task.id))
      const enabled = task.enabled !== false
      if (enabled && this.isDue(ws.id, task.id, taskWhen(task), nowMs)) {
        await this.fire(ws, task.id, task.what, task.agent, nowMs)
      }
      // Read the marker AFTER any fire so last/next reflect a just-fired run.
      const last = this.deps.markers.get(ws.id, task.id) ?? null
      tasks.push(snapshotTask(task, last, nowMs, this.intervalMs))
    }
    return { wsId: ws.id, tag: ws.tag, status: 'ok', tasks }
  }

  private isDue(wsId: string, taskId: string, when: ReturnType<typeof taskWhen>, nowMs: number): boolean {
    const last = this.deps.markers.get(wsId, taskId) ?? null
    const next = computeNextRun(when, fireBase(when, last, nowMs, this.intervalMs))
    return next !== null && next <= nowMs
  }

  private async fire(
    ws: WorkspaceMeta,
    taskId: string,
    what: string,
    agentId: string | undefined,
    nowMs: number,
  ): Promise<void> {
    const adapter = this.deps.resolveAdapter(ws, agentId)
    if (!adapter.capabilities.headless || !adapter.composeHeadlessCommand) {
      this.deps.logger.warn('schedule.adapter_not_headless', { wsId: ws.id, taskId, agent: adapter.id })
      return
    }
    try {
      const { taskId: runId } = await this.deps.dispatch(ws, adapter, what, RUN_TIMEOUT_MS)
      await this.deps.markers.set(ws.id, taskId, nowMs)
      this.deps.logger.info('schedule.fired', { wsId: ws.id, taskId, agent: adapter.id, runId })
    } catch (err) {
      // Capacity full (or transient) - do NOT mark; the task stays due and
      // retries on the next tick once a headless slot frees.
      this.deps.logger.info('schedule.fire_skipped', {
        wsId: ws.id,
        taskId,
        reason: err instanceof Error ? err.message : String(err),
      })
    }
  }
}
