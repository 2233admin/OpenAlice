import { Hono } from 'hono'
import { readUpdatePreferences } from '../../core/update-preferences.js'
import type { WorkspaceUpdateService } from '../../workspaces/workspace-update-service.js'

export function createUpdateRoutes(coordinator: Pick<WorkspaceUpdateService, 'check' | 'list'>, activate: () => void) {
  const app = new Hono()
  app.post('/activate', (c) => {
    activate()
    return c.json({ accepted: true }, 202)
  })
  app.get('/', async (c) => c.json({
    preferences: await readUpdatePreferences(),
    workspaces: coordinator.list(),
  }))
  app.post('/check', async (c) => {
    await coordinator.check()
    return c.json({ preferences: await readUpdatePreferences(), workspaces: coordinator.list() })
  })
  return app
}
