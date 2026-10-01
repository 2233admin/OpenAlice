import { http, HttpResponse } from 'msw'
import { DEMO_AUTO_QUANT_WORKSPACE_ID } from '../fixtures/workspaces'

let preferences = {
  autoCheckApp: true,
  autoUpdateAutoQuant: true,
  autoUpdateAutoPrediction: true,
}
// Deliberately blocked by the seeded running Quant Session. Toggling auto
// application does not make the observable upstream release disappear.
export const demoHarnessSourceCandidate = {
  fromVersion: 'v0.8.31', toVersion: 'v0.8.32', verified: false,
  toCommit: 'b'.repeat(40),
}
const snapshot = () => ({ preferences, workspaces: [{
  workspaceId: DEMO_AUTO_QUANT_WORKSPACE_ID, template: 'auto-quant-v2',
  phase: preferences.autoUpdateAutoQuant ? 'blocked' : 'available',
  fromVersion: demoHarnessSourceCandidate.fromVersion, toVersion: demoHarnessSourceCandidate.toVersion, verified: demoHarnessSourceCandidate.verified,
  checkedAt: new Date().toISOString(),
  ...(preferences.autoUpdateAutoQuant ? { reason: 'active_runtime' } : {}),
}] })

let clientPreferences = { autoCheck: true }
const clientSnapshot = () => ({
  kind: 'cli', currentVersion: '0.94.1-beta.2', preferences: clientPreferences,
  discovery: { value: { status: 'current', currentVersion: '0.94.1-beta.2', channel: 'beta' },
    checking: false, error: null, checkedAt: Date.now(), succeededAt: Date.now() },
})
export const updatesHandlers = [
  http.get('/relay/v1/updates', () => HttpResponse.json(clientSnapshot())),
  http.post('/relay/v1/updates/check', () => HttpResponse.json(clientSnapshot())),
  http.post('/relay/v1/updates/activate', () => HttpResponse.json({ accepted: true }, { status: 202 })),
  http.put('/relay/v1/updates/preferences', async ({ request }) => {
    const body = await request.json() as { autoCheck?: unknown }
    if (typeof body?.autoCheck !== 'boolean') return HttpResponse.json({ error: 'invalid_preferences' }, { status: 400 })
    clientPreferences = { autoCheck: body.autoCheck }
    return HttpResponse.json(clientSnapshot())
  }),
  http.post('/api/updates/activate', () => HttpResponse.json({ accepted: true }, { status: 202 })),
  http.get('/api/updates', () => HttpResponse.json(snapshot())),
  http.post('/api/updates/check', () => HttpResponse.json(snapshot())),
  http.get('/api/preferences/updates', () => HttpResponse.json(preferences)),
  http.put('/api/preferences/updates', async ({ request }) => {
    const body = await request.json().catch(() => null) as typeof preferences | null
    if (!body || Object.values(body).some(value => typeof value !== 'boolean')) {
      return HttpResponse.json({ error: 'invalid_update_preferences' }, { status: 400 })
    }
    preferences = body
    return HttpResponse.json(preferences)
  }),
]
