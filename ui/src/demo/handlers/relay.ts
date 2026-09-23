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
    key: 'local', displayName: 'This computer', connection: 'local', issue: null,
    projects: [{ key: 'demo', id: 'demo-alice-project', displayName: 'Demo AliceProject', available: true, runtime: { class: 'running', state: 'ready', webEndpoint: 'http://127.0.0.1:47331' } }],
  },
  {
    key: 'studio', displayName: 'Studio Mac', connection: 'online', issue: null,
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
]

export function currentDemoRelayProject() {
  const selected = machines.find((machine) => machine.key === target.machine)?.projects.find((project) => project.key === target.project)
  return selected ? { id: selected.id, key: selected.key, displayName: selected.displayName } : { id: 'demo-alice-project', key: 'demo', displayName: 'Demo AliceProject' }
}
