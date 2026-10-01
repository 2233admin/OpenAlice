// @vitest-environment jsdom
import { afterAll, beforeAll, expect, it } from 'vitest'
import { setupServer } from 'msw/node'
import { DEMO_AUTO_QUANT_WORKSPACE_ID, DEMO_AUTO_PREDICTION_WORKSPACE_ID } from '../../../ui/src/demo/fixtures/workspaces'
import { workspacesHandlers } from '../../../ui/src/demo/handlers/workspaces'
import { updatesHandlers } from '../../../ui/src/demo/handlers/updates'

const server = setupServer(...workspacesHandlers, ...updatesHandlers)
const base = window.location.origin
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

it('keeps source overview and review on the same candidate with an explicit runtime blocker', async () => {
  const status = await fetch(`${base}/api/updates`).then(response => response.json())
  const { plan } = await fetch(`${base}/api/workspaces/${DEMO_AUTO_QUANT_WORKSPACE_ID}/source-upgrade`).then(response => response.json())
  expect(plan).toMatchObject({ workspaceId: DEMO_AUTO_QUANT_WORKSPACE_ID, strategy: 'source-merge',
    toVersion: status.workspaces[0].toVersion, verified: status.workspaces[0].verified,
    blocked: true, blockers: ['active_runtime'] })
  expect(plan.fromCommit).not.toBe(plan.toCommit)
  expect((await fetch(`${base}/api/workspaces/${DEMO_AUTO_QUANT_WORKSPACE_ID}/source-upgrade`, { method: 'POST' })).status).toBe(409)
})

it('returns a current exact source receipt when there is no newer candidate', async () => {
  const { plan } = await fetch(`${base}/api/workspaces/${DEMO_AUTO_PREDICTION_WORKSPACE_ID}/source-upgrade`).then(response => response.json())
  expect(plan.fromVersion).toBe(plan.toVersion)
  expect(plan.fromCommit).toBe(plan.toCommit)
  expect(plan.changedPaths).toEqual([])
})
