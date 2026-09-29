import { http, HttpResponse } from 'msw'
import { DEMO_AUTO_QUANT_WORKSPACE_ID } from '../fixtures/workspaces'

let preferences = {
  autoCheckApp: true,
  autoUpdateAutoQuant: true,
  autoUpdateAutoPrediction: true,
}
// Deliberately blocked by the seeded running Quant Session. Toggling auto
// application does not make the observable upstream release disappear.
const snapshot = () => ({ preferences, workspaces: [{
  workspaceId: DEMO_AUTO_QUANT_WORKSPACE_ID, template: 'auto-quant-v2',
  phase: preferences.autoUpdateAutoQuant ? 'blocked' : 'available',
  fromVersion: 'v0.8.31', toVersion: 'v0.8.32', verified: false,
  checkedAt: new Date().toISOString(),
  ...(preferences.autoUpdateAutoQuant ? { reason: 'active_runtime' } : {}),
}] })

export const updatesHandlers = [
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
