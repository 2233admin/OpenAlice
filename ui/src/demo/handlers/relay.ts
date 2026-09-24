import { delay, http, HttpResponse } from 'msw'

const defaultTarget = { machine: 'local', machineName: 'This computer', project: 'demo', projectName: 'Demo AliceProject' }
let target = readDemoTarget() ?? defaultTarget
let generation = 0

function readDemoTarget(): typeof defaultTarget | null {
  if (typeof window === 'undefined') return null
  try {
    const value = JSON.parse(window.sessionStorage.getItem('openalice.demo.relay-target') ?? 'null') as Partial<typeof defaultTarget> | null
    return value && typeof value.machine === 'string' && typeof value.project === 'string' && typeof value.machineName === 'string' && typeof value.projectName === 'string'
      ? value as typeof defaultTarget : null
  } catch { return null }
}

const machines = [
  {
    key: 'local', displayName: 'This computer', connection: 'local', cliVersion: '0.94.1-beta', issue: null,
    projects: [{ key: 'demo', id: 'demo-alice-project', displayName: 'Demo AliceProject', available: true, runtime: { class: 'running', state: 'ready', webEndpoint: 'http://127.0.0.1:47331' } }],
  },
  {
    key: 'studio', displayName: 'Studio Mac', connection: 'online', sshTarget: 'alice@studio-mac.local', cliVersion: '0.93.1', issue: null,
    projects: [
      { key: 'research', id: 'demo-research', displayName: 'Research desk', available: true, runtime: { class: 'running', state: 'ready', webEndpoint: 'http://127.0.0.1:47332' } },
      { key: 'drafts', id: 'demo-drafts', displayName: 'Drafts', available: true, runtime: { class: 'absent', state: 'stopped', webEndpoint: null } },
    ],
  },
]

export const relayHandlers = [
  http.get('/relay/v1/status', () => HttpResponse.json({ schemaVersion: 1, generation, target, switching: false })),
  http.get('/relay/v1/fleet', async () => {
    await delay(900)
    return HttpResponse.json({ schemaVersion: 1, generatedAt: new Date().toISOString(), machines })
  }),
  http.post('/relay/v1/connect', async ({ request }) => {
    const input = await request.json() as { machine?: string; project?: string }
    const selected = machines.find((machine) => machine.key === input.machine)?.projects.find((project) => project.key === input.project)
    if (!selected?.runtime.webEndpoint) return HttpResponse.json({ error: 'Start this AliceProject first.' }, { status: 409 })
    target = { machine: input.machine!, machineName: machines.find((machine) => machine.key === input.machine)!.displayName, project: input.project!, projectName: selected.displayName }
    try { window.sessionStorage.setItem('openalice.demo.relay-target', JSON.stringify(target)) } catch { /* Demo can run without storage. */ }
    generation += 1
    return HttpResponse.json({ schemaVersion: 1, generation, target, switching: false })
  }),
  http.post('/relay/v1/machines/plan', async ({ request }) => {
    const input = await request.json() as { mode: 'add' | 'upgrade'; machineKey?: string; sshTarget?: string; label?: string }
    await delay(700)
    const machine = machines.find((entry) => entry.key === input.machineKey)
    return HttpResponse.json({
      id: 'demo-machine-plan', mode: input.mode,
      machine: { key: machine?.key ?? null, label: machine?.displayName ?? input.label ?? 'Cloud Linux', sshTarget: machine?.sshTarget ?? input.sshTarget ?? 'alice@cloud.example.com' },
      platform: 'macOS arm64', installedVersion: '0.93.1', targetVersion: '0.94.1',
      runtime: 'running · cli-server', actions: ['update remote OpenAlice CLI', 'restart remote OpenAlice Server'], blocker: null, deferredUpdate: false,
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
    })
  }),
  http.post('/relay/v1/machines/apply', async () => {
    await delay(900)
    return HttpResponse.json({ machineKey: 'studio' })
  }),
]

export function currentDemoRelayProject() {
  const selected = machines.find((machine) => machine.key === target.machine)?.projects.find((project) => project.key === target.project)
  return selected ? { id: selected.id, key: selected.key, displayName: selected.displayName } : { id: 'demo-alice-project', key: 'demo', displayName: 'Demo AliceProject' }
}
