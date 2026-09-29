import {
  identityLabel,
  isReleaseUpdate,
  type ReleaseChannel,
} from '../../../lib/updates/discovery'
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
  client: 'App only',
  integrated: 'Integrated Electron',
  blocked: 'Backend ahead of app',
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
  return {
    scenario,
    phase: 'scenario',
    backend: scenario !== 'client',
    content: scenario === 'busy',
    target: version,
    channel: 'stable',
    publication: initialPublication(),
    selectedRelease: null,
    client: version,
    clientInstalled: version,
    server: version,
    serverInstalled: version,
    workspace: 'R1',
    connected: true,
    busy: scenario === 'busy',
    fault: scenario === 'reconnect',
    steps: [],
    cursor: 0,
    log: [],
  }
}
export function plan(s: State): Step[] {
  const steps: Step[] = []
  if (s.scenario !== 'blocked' && s.client !== s.target)
    steps.push(
      'client-download',
      'client-install',
      'client-activate',
      'client-verify',
    )
  if (s.backend && s.server !== s.target && s.scenario !== 'integrated')
    steps.push(
      'backend-download',
      'backend-install',
      'backend-activate',
      'backend-reconnect',
    )
  if (s.content && s.workspace !== 'R2')
    steps.push('content-check', 'content-apply', 'content-verify')
  return steps
}
export function blocker(s: State): string | null {
  if (plan(s).some((step) => step.endsWith('-download')) && !s.selectedRelease)
    return 'Check the selected channel before preparing an installation.'
  if (s.scenario === 'integrated' && s.channel === 'dev')
    return 'Dev commit artifacts are CLI-only in this rehearsal. Choose a separated scenario.'
  if (s.scenario === 'blocked' && s.backend && s.target !== s.client)
    return 'This plan would put the backend ahead of the app. Upgrade the app first.'
  const server = s.backend || s.scenario === 'integrated' ? s.target : s.server
  if (s.content && server.split('+')[0] === '0.94.1')
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
      log: [
        ...s.log,
        'Retrying reconnect; completed installation is retained.',
      ],
    }
  if (s.phase === 'scenario') {
    if (a.type === 'scenario')
      return {
        ...initial(a.value),
        publication: s.publication,
        channel: s.channel,
      }
    if (a.type === 'channel')
      return { ...s, channel: a.value, selectedRelease: null, target: s.client }
    if (a.type === 'discover') {
      const release = head(s.publication, s.channel)
      const [version, commit] = s.client.split('+dev.')
      const clientUpdate = isReleaseUpdate(
        {
          version,
          channel: commit ? 'dev' : version.includes('-') ? 'beta' : 'stable',
          commit,
        },
        release,
        s.channel,
      )
      const [serverVersion, serverCommit] = s.server.split('+dev.')
      const update =
        clientUpdate ||
        (s.backend &&
          isReleaseUpdate(
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
          ))
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
      return {
        ...s,
        steps,
        phase: steps.length ? 'running' : 'done',
        log: [`Approved immutable target ${s.target}; ${steps.length} stages.`],
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
  if (step === 'client-install') next.clientInstalled = s.target
  if (step === 'client-activate') {
    next.client = s.target
    next.phase = 'suspended'
    if (s.scenario === 'integrated')
      next.server = next.serverInstalled = s.target
  }
  if (step === 'backend-install') next.serverInstalled = s.target
  if (step === 'backend-activate') {
    next.server = s.target
    next.connected = false
  }
  if (step === 'backend-reconnect') next.connected = true
  if (step === 'content-apply') next.workspace = 'R2'
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
