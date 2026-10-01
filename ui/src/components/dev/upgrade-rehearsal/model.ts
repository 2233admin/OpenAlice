import {
  identityLabel,
  newerRelease,
  selectRelease,
  planRuntimeUpdate,
  beginRuntimeOperation,
  transitionRuntimeOperation,
  type RuntimeOperation,
  type RuntimeRelease,
  type RuntimeStage,
  type ReleaseChannel,
} from '@traderalice/update-lifecycle'
import {
  initialPublication,
  createRelease,
  advanceRelease,
  head,
  releaseAssets,
  type Publication,
  type SimRelease,
} from './releases'
import snapshot from './release-snapshot.json'

// This is a rehearsal contract, not the production compatibility policy.
// Release progression is simulated from the recorded v0.94.1 baseline.
export const scenarios = {
  together: 'App + remote backend',
  'pending-activation': 'Stable installed, beta still running',
  'stable-over-beta': 'Older beta client, stable backend',
  client: 'App only',
  integrated: 'Integrated Electron',
  blocked: 'Prevent backend-only upgrade',
  'client-ahead': 'Frontend newer than backend',
  'server-ahead': 'Backend newer than frontend',
  'chat-follow': 'Backend upgrade brings a Chat template update',
  'chat-stale': 'Backend current, Chat template outdated',
  'chat-busy': 'Chat busy during backend upgrade',
  reconnect: 'Reconnect failure',
  busy: 'Workspace busy',
} as const
export type Scenario = keyof typeof scenarios
export type Step =
  | 'client-download'
  | 'client-install'
  | 'client-activate'
  | 'client-verify'
  | 'backend-download'
  | 'backend-install'
  | 'backend-activate'
  | 'backend-verify'
  | 'backend-reconnect'
  | 'content-check'
  | 'content-apply'
  | 'content-verify'
export type Phase =
  | 'scenario'
  | 'review'
  | 'running'
  | 'suspended'
  | 'failed'
  | 'blocked'
  | 'done'
export interface State {
  scenario: Scenario
  phase: Phase
  backend: boolean
  content: boolean
  target: string
  channel: ReleaseChannel
  publication: Publication
  selectedRelease: SimRelease | null
  client: string
  clientInstalled: string
  server: string
  serverInstalled: string
  workspace: string
  connected: boolean
  busy: boolean
  fault: boolean
  operations: { client: RuntimeOperation | null; backend: RuntimeOperation | null }
  steps: Step[]
  cursor: number
  log: string[]
}
export type Action =
  | { type: 'scenario'; value: Scenario }
  | { type: 'backend' | 'content'; value: boolean }
  | { type: 'channel' | 'publish'; value: ReleaseChannel }
  | { type: 'advance'; value: string }
  | { type: 'discover' }
  | {
      type:
        | 'review'
        | 'back'
        | 'approve'
        | 'next'
        | 'resume'
        | 'retry'
        | 'release'
        | 'reset'
        | 'continue'
    }
export function initial(scenario: Scenario = 'together'): State {
  const version = '0.94.1'
  const mismatch = [
    'client-ahead',
    'server-ahead',
    'chat-follow',
    'chat-stale',
    'chat-busy',
  ].includes(scenario)
  let publication = initialPublication()
  if (mismatch) {
    publication = createRelease(publication, 'stable')
    const id = publication.records.at(-1)!.id
    for (let i = 0; i < 3; i++) publication = advanceRelease(publication, id)
  }
  const client = scenario === 'stable-over-beta' ? '0.94.1-beta.2' : mismatch && scenario !== 'server-ahead' ? '0.94.2' : version
  const server = scenario === 'pending-activation' ? '0.94.1-beta.2' :
    scenario === 'server-ahead' || scenario === 'chat-stale'
      ? '0.94.2'
      : version
  return {
    scenario,
    phase: 'scenario',
    backend: scenario !== 'client',
    content: scenario === 'busy' || scenario.startsWith('chat-'),
    target: scenario === 'stable-over-beta' ? client : mismatch ? '0.94.2' : version,
    channel: scenario === 'stable-over-beta' ? 'beta' : 'stable',
    publication,
    selectedRelease: mismatch ? head(publication, 'stable') : null,
    client,
    clientInstalled: client,
    server,
    serverInstalled: scenario === 'pending-activation' ? version : server,
    operations: { client: null, backend: null },
    workspace: scenario.startsWith('chat-') ? 'Chat template 1' : 'R1',
    connected: true,
    busy: scenario === 'busy' || scenario === 'chat-busy',
    fault: scenario === 'reconnect',
    steps: [],
    cursor: 0,
    log: [],
  }
}
export function isChatCase(s: State): boolean {
  return s.scenario.startsWith('chat-')
}
// This fixture models the bundled template identity independently from app SemVer.
// Real managed-context apply must still use its preview digest and merge guards.
export function contentTarget(s: State): string {
  const backend = projectedServer(s)
  return isChatCase(s)
    ? newerRelease(backend.split('+')[0], '0.94.1')
      ? 'Chat template 2'
      : 'Chat template 1'
    : 'R2'
}
function projectedServer(s: State): string {
  return s.backend || s.scenario === 'integrated'
    ? runtimeTargetVersion(s, s.scenario === 'integrated' ? 'client' : 'backend')
    : s.server
}
export function runtimeTargetVersion(s: State, unit: 'client' | 'backend'): string {
  const target = s.operations[unit]?.target ?? runtimePlans(s)[unit].target
  return target ? target.commit ? `${target.version}+dev.${target.commit}` : target.version
    : unit === 'client' ? s.clientInstalled : s.serverInstalled
}
export function scenarioExplanation(s: State): string {
  switch (s.scenario) {
    case 'pending-activation':
      return 'Stable is already installed. Restart and verify the backend without downloading or installing again.'
    case 'stable-over-beta':
      return 'The older beta client keeps the verified stable backend. Connecting does not change the Machine channel.'
    case 'client-ahead':
      return 'Frontend 0.94.2 / backend 0.94.1. Keep the frontend; upgrade only the selected backend.'
    case 'server-ahead':
      return 'Frontend 0.94.1 / backend 0.94.2. Catch the frontend up; do not downgrade the backend. Compatibility is a rehearsal assumption.'
    case 'chat-follow':
      return 'Frontend 0.94.2 / backend 0.94.1 / Chat template 1. Reconnect to backend 0.94.2 before applying its bundled Chat template 2.'
    case 'chat-stale':
      return 'Both app and backend are 0.94.2; Chat still has template 1. Only the managed Chat template needs updating.'
    case 'chat-busy':
      return 'Upgrade the backend first. If Chat is busy, keep its template unchanged and wait; completed backend work is retained.'
    default:
      return 'Select a channel, discover a release, then review the proposed update scope.'
  }
}
function release(version: string): RuntimeRelease {
  const [core, commit] = version.split('+dev.')
  return { version: core, channel: commit ? 'dev' : core.includes('-') ? 'beta' : 'stable', ...(commit ? { commit } : {}) }
}
export function runtimePlans(s: State) {
  const candidate = release(s.target) as RuntimeRelease & { channel: ReleaseChannel }
  const make = (installed: string, active: string, reconnect: boolean) => planRuntimeUpdate({
    installed: release(installed), candidate, active: release(active), running: true,
    canActivate: true, channel: s.channel, reconnect,
  })
  return { client: make(s.clientInstalled, s.client, false), backend: make(s.serverInstalled, s.server, true) }
}
export function plan(s: State): Step[] {
  const steps: Step[] = []
  const plans = runtimePlans(s)
  for (const unit of ['client', 'backend'] as const) {
    if (unit === 'client' && s.scenario === 'blocked') continue
    if (unit === 'backend' && (!s.backend || s.scenario === 'integrated')) continue
    const operation = plans[unit]
    if (!operation.stages.some(stage => stage === 'install' || stage === 'activate') && (unit !== 'backend' || s.connected)) continue
    for (const stage of operation.stages) {
      if (stage === 'install') steps.push(`${unit}-download`)
      steps.push(`${unit}-${stage}` as Step)
    }
  }
  if (s.content && s.workspace !== contentTarget(s))
    steps.push('content-check', 'content-apply', 'content-verify')
  return steps
}
export function blocker(s: State): string | null {
  const operations = runtimePlans(s)
  if (operations.client.blocker || (s.backend && operations.backend.blocker))
    return operations.client.blocker ?? operations.backend.blocker
  if (plan(s).some((step) => step.endsWith('-download')) && !s.selectedRelease)
    return 'Check the selected channel before preparing an installation.'
  if (s.scenario === 'integrated' && s.channel === 'dev')
    return 'Dev commit artifacts are CLI-only in this rehearsal. Choose a separated scenario.'
  if (s.scenario === 'blocked' && s.backend && s.target !== s.client)
    return 'This plan would put the backend ahead of the app. Upgrade the app first.'
  const server = projectedServer(s)
  if (s.content && !isChatCase(s) && server.split('+')[0] === '0.94.1')
    return 'Workspace R2 needs backend 0.94.2 or newer (rehearsal assumption).'
  return null
}
export function reduce(s: State, a: Action): State {
  if (a.type === 'publish')
    return { ...s, publication: createRelease(s.publication, a.value) }
  if (a.type === 'advance')
    return { ...s, publication: advanceRelease(s.publication, a.value) }
  if (a.type === 'continue' && s.phase === 'done')
    return {
      ...s,
      phase: 'scenario',
      target: s.client,
      selectedRelease: null,
      steps: [],
      cursor: 0,
    }
  if (a.type === 'reset') return initial(s.scenario)
  if (a.type === 'release' && s.phase === 'blocked')
    return {
      ...s,
      busy: false,
      phase: 'running',
      log: [...s.log, 'Workspace released. Continue the same approved plan.'],
    }
  if (a.type === 'resume' && s.phase === 'suspended')
    return {
      ...s,
      phase: 'running',
      log: [...s.log, 'App resumed; approved target retained.'],
    }
  if (a.type === 'retry' && s.phase === 'failed')
    return {
      ...s,
      phase: 'running',
      operations: { client: s.operations.client && transitionRuntimeOperation(s.operations.client, { type: 'retry' }),
        backend: s.operations.backend && transitionRuntimeOperation(s.operations.backend, { type: 'retry' }) },
      log: [
        ...s.log,
        'Retrying the unfinished stage; completed installation is retained.',
      ],
    }
  if (s.phase === 'scenario') {
    if (a.type === 'scenario') return initial(a.value)
    if (a.type === 'channel')
      return { ...s, channel: a.value, selectedRelease: null, target: s.client }
    if (a.type === 'discover') {
      const release = head(s.publication, s.channel)
      const [version, commit] = s.client.split('+dev.')
      const clientUpdate = selectRelease(
        {
          version,
          channel: commit ? 'dev' : version.includes('-') ? 'beta' : 'stable',
          commit,
        },
        release,
        s.channel,
      ).status === 'available'
      const [serverVersion, serverCommit] = s.server.split('+dev.')
      const update =
        clientUpdate ||
        (s.backend &&
          selectRelease(
            {
              version: serverVersion,
              channel: serverCommit
                ? 'dev'
                : serverVersion.includes('-')
                  ? 'beta'
                  : 'stable',
              commit: serverCommit,
            },
            release,
            s.channel,
          ).status === 'available')
      return {
        ...s,
        selectedRelease: update ? release : null,
        target: update && release ? identityLabel(release) : s.client,
      }
    }
    if (a.type === 'backend' || a.type === 'content')
      return { ...s, [a.type]: a.value }
    if (a.type === 'review') return { ...s, phase: 'review' }
  }
  if (s.phase === 'review') {
    if (a.type === 'back') return { ...s, phase: 'scenario' }
    if (a.type === 'approve' && !blocker(s)) {
      const steps = plan(s)
      const plans = runtimePlans(s)
      const operations = { client: steps.some(step => step.startsWith('client-')) ? beginRuntimeOperation(plans.client) : null,
        backend: steps.some(step => step.startsWith('backend-')) ? beginRuntimeOperation(plans.backend) : null }
      return {
        ...s,
        steps,
        operations,
        phase: steps.length ? 'running' : 'done',
        log: [`Approved plan: client ${runtimeTargetVersion(s, 'client')}, backend ${runtimeTargetVersion(s, 'backend')}; ${steps.length} stages.`],
      }
    }
  }
  if (a.type !== 'next' || s.phase !== 'running') return s
  const step = s.steps[s.cursor]
  if (!step) return s
  if (step.startsWith('content-') && s.busy)
    return {
      ...s,
      phase: 'blocked',
      log: [...s.log, 'Workspace is busy. No content was changed.'],
    }
  if (step === 'backend-reconnect' && s.fault)
    return {
      ...s,
      fault: false,
      phase: 'failed',
      operations: { ...s.operations, backend: s.operations.backend && transitionRuntimeOperation(s.operations.backend, { type: 'fail', error: 'Reconnect failed' }) },
      log: [
        ...s.log,
        'Simulated reconnect failure. Backend is already upgraded.',
      ],
    }
  const next = {
    ...s,
    cursor: s.cursor + 1,
    log: [...s.log, `${step} completed`],
  }
  const target = (unit: 'client' | 'backend') => runtimeTargetVersion(s, unit)
  if (step === 'client-install') next.clientInstalled = target('client')
  if (step === 'client-activate') {
    next.client = target('client')
    next.phase = 'suspended'
    if (s.scenario === 'integrated')
      next.server = next.serverInstalled = target('client')
  }
  if (step === 'backend-install') next.serverInstalled = target('backend')
  if (step === 'backend-activate') {
    next.server = target('backend')
    next.connected = false
  }
  if (step === 'backend-reconnect') next.connected = true
  if (step === 'content-apply') next.workspace = contentTarget(s)
  if ((step.startsWith('client-') || step.startsWith('backend-')) && !step.endsWith('-download')) {
    const unit = step.startsWith('client-') ? 'client' : 'backend'
    const operation = s.operations[unit]
    if (operation) {
      const stage = step.slice(unit.length + 1) as RuntimeStage
      const observed = release(unit === 'client'
        ? stage === 'install' ? next.clientInstalled : next.client
        : stage === 'install' ? next.serverInstalled : next.server)
      try {
        next.operations = { ...s.operations, [unit]: transitionRuntimeOperation(operation, { type: 'complete', stage, observed }) }
      } catch (error) {
        return { ...s, phase: 'failed', operations: { ...s.operations,
          [unit]: transitionRuntimeOperation(operation, { type: 'fail', error: String(error) }) },
          log: [...s.log, String(error)] }
      }
    }
  }
  if (next.cursor === next.steps.length) next.phase = 'done'
  return next
}
export function group(name: string) {
  if (name.startsWith('OpenAlice-Broker')) return 'Broker packs'
  if (name.startsWith('openalice-cli')) return 'CLI · 6 targets'
  if (name.includes('-install')) return 'Installers'
  if (
    name.startsWith('OpenAlice-') ||
    name.startsWith('OpenAlice.Setup') ||
    name.endsWith('.yml')
  )
    return 'Desktop · macOS + Windows x64'
  return 'Package managers'
}
export const releaseSnapshot = snapshot
export function consumed(s: State) {
  const steps =
    s.phase === 'scenario' || s.phase === 'review' ? plan(s) : s.steps
  if (!s.selectedRelease) return []
  const r = s.selectedRelease
  const inventory = releaseAssets(r)
  if (r.channel === 'dev')
    return inventory.filter(
      (n) =>
        (n.includes('openalice-cli-') &&
          n.includes('darwin-arm64') &&
          steps.includes('client-download')) ||
        (n.includes('openalice-cli-') &&
          n.includes('linux-x64') &&
          steps.includes('backend-download')) ||
        n.endsWith('/install'),
    )
  const names: string[] = steps.includes('client-download')
    ? [
        `${r.channel === 'beta' ? 'beta' : 'latest'}-mac.yml`,
        `OpenAlice-${r.version}-arm64-mac.zip`,
      ]
    : []
  if (steps.includes('backend-download'))
    names.push(
      `OpenAlice-${r.version}-install`,
      `OpenAlice-${r.version}-install.sha256`,
      `openalice-cli-${r.version}-linux-x64.tar.gz`,
      `openalice-cli-${r.version}-linux-x64.tar.gz.sha256`,
    )
  return names
}
