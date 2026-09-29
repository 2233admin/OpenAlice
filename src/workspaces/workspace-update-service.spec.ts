import { beforeEach, expect, it, vi } from 'vitest'
import { readUpdatePreferences } from '../core/update-preferences.js'
import { readHarnessSource } from './harness-source.js'
import { WorkspaceUpdateService } from './workspace-update-service.js'
import type { WorkspaceService } from './service.js'

vi.mock('../core/update-preferences.js', () => ({ readUpdatePreferences: vi.fn() }))
vi.mock('./harness-source.js', () => ({ readHarnessSource: vi.fn() }))

const preferences = { autoCheckApp: true, autoUpdateAutoQuant: true, autoUpdateAutoPrediction: true }
function service() {
  return {
    registry: { list: () => [{ id: 'aq', dir: '/workspace/aq', template: 'auto-quant-v2' }] },
    sourceUpgrades: {
      latest: vi.fn().mockResolvedValue({ version: '1.3.0', verified: false }),
      plan: vi.fn().mockResolvedValue({ blocked: false, blockers: [], planDigest: 'reviewed-digest' }),
      apply: vi.fn().mockResolvedValue({ workspaceId: 'aq' }),
    },
  }
}

beforeEach(() => {
  vi.mocked(readUpdatePreferences).mockResolvedValue({ ...preferences })
  vi.mocked(readHarnessSource).mockResolvedValue({ version: '1.2.0' } as Awaited<ReturnType<typeof readHarnessSource>>)
})

it('applies an upstream stable tag through the reviewed source manager when safe', async () => {
  const svc = service()
  const updates = new WorkspaceUpdateService(svc as unknown as WorkspaceService)
  await updates.refreshAndApplyPolicy()
  expect(svc.sourceUpgrades.latest).toHaveBeenCalledWith('auto-quant-v2', '1.2.0', true)
  expect(svc.sourceUpgrades.plan).toHaveBeenCalledWith('aq', true, '1.3.0')
  expect(svc.sourceUpgrades.apply).toHaveBeenCalledWith('aq', true, { planDigest: 'reviewed-digest', targetVersion: '1.3.0' })
  expect(updates.list()).toMatchObject([{ phase: 'updated', verified: false }])
})

it('reports a blocker and leaves the Workspace untouched', async () => {
  const svc = service()
  svc.sourceUpgrades.plan.mockResolvedValue({ blocked: true, blockers: ['active_runtime'], planDigest: 'reviewed-digest' })
  const updates = new WorkspaceUpdateService(svc as unknown as WorkspaceService)
  await updates.refreshAndApplyPolicy()
  expect(svc.sourceUpgrades.apply).not.toHaveBeenCalled()
  expect(updates.list()).toMatchObject([{ phase: 'blocked', reason: 'active_runtime' }])
})

it('discovers available releases while automatic application is disabled', async () => {
  vi.mocked(readUpdatePreferences).mockResolvedValue({ ...preferences, autoUpdateAutoQuant: false })
  const svc = service()
  const updates = new WorkspaceUpdateService(svc as unknown as WorkspaceService)
  await updates.check()
  expect(svc.sourceUpgrades.latest).toHaveBeenCalled()
  await updates.applyPolicy()
  expect(svc.sourceUpgrades.apply).not.toHaveBeenCalled()
  expect(updates.list()).toMatchObject([{ phase: 'available', toVersion: '1.3.0' }])
})

it('manual checks never plan or apply even with automatic updates enabled', async () => {
  const svc = service()
  const updates = new WorkspaceUpdateService(svc as unknown as WorkspaceService)
  await updates.check()
  expect(svc.sourceUpgrades.plan).not.toHaveBeenCalled()
  expect(svc.sourceUpgrades.apply).not.toHaveBeenCalled()
  expect(updates.list()).toMatchObject([{ phase: 'available', toVersion: '1.3.0' }])
})

it('a preference revoked during planning prevents the merge', async () => {
  const svc = service()
  svc.sourceUpgrades.plan.mockImplementation(async () => {
    vi.mocked(readUpdatePreferences).mockResolvedValue({ ...preferences, autoUpdateAutoQuant: false })
    return { blocked: false, blockers: [], planDigest: 'reviewed-digest' }
  })
  const updates = new WorkspaceUpdateService(svc as unknown as WorkspaceService)
  await updates.refreshAndApplyPolicy()
  expect(svc.sourceUpgrades.apply).not.toHaveBeenCalled()
  expect(updates.list()).toMatchObject([{ phase: 'available' }])
})

it('coalesces checks and does not apply a retained candidate after failed discovery', async () => {
  const svc = service()
  const updates = new WorkspaceUpdateService(svc as unknown as WorkspaceService)
  const first = updates.check()
  expect(updates.check()).toBe(first)
  await first
  expect(svc.sourceUpgrades.latest).toHaveBeenCalledOnce()
  svc.sourceUpgrades.latest.mockRejectedValueOnce(new Error('upstream offline'))
  await updates.refreshAndApplyPolicy()
  expect(updates.list()).toMatchObject([{ phase: 'failed', toVersion: '1.3.0', reason: 'upstream offline' }])
  expect(svc.sourceUpgrades.apply).not.toHaveBeenCalled()
})
