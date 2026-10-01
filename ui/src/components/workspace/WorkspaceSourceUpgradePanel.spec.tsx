// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { WorkspacePlanStore } from '../../lib/updates/workspacePlans'
let planStore: WorkspacePlanStore
vi.mock('../../hooks/useUpdateLifecycle', () => ({ useUpdateLifecycle: () => ({ workspacePlans: planStore }) }))

import { i18n } from '../../i18n'
import { WorkspaceSourceUpgradePanel } from './WorkspaceSourceUpgradePanel'
import * as api from './api'

vi.mock('./api', async (importOriginal) => ({
  ...await importOriginal<typeof import('./api')>(),
  getHarnessSourceUpgradePlan: vi.fn(),
  applyHarnessSourceUpgrade: vi.fn(),
}))

const plan = {
  workspaceId: 'aq-1',
  template: 'auto-quant-v2',
  fromVersion: 'v0.9.34',
  fromCommit: 'a'.repeat(40),
  toVersion: 'v0.9.35',
  toCommit: 'b'.repeat(40),
  verified: false,
  strategy: 'source-merge' as const,
  protocolCompatible: true,
  manifestVersion: 1,
  planDigest: 'digest-1',
  blocked: false,
  blockers: [],
  activity: { busy: false, sessions: [], headless: [] },
  changedPaths: ['harness.json', 'studio/server.ts'],
  conflictedPaths: [],
}

beforeEach(async () => {
  planStore = new WorkspacePlanStore()
  await i18n.changeLanguage('en')
  vi.mocked(api.getHarnessSourceUpgradePlan).mockResolvedValue(plan)
  vi.mocked(api.applyHarnessSourceUpgrade).mockResolvedValue({
    workspaceId: 'aq-1',
    fromVersion: 'v0.9.34',
    toVersion: 'v0.9.35',
    commit: 'c'.repeat(40),
    verified: false,
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('WorkspaceSourceUpgradePanel', () => {
  it('labels an upstream-only release and requires the explicit unverified action', async () => {
    const changed = vi.fn()
    render(<WorkspaceSourceUpgradePanel wsId="aq-1" onWorkspaceChanged={changed} />)
    expect(await screen.findByText('Not verified by OpenAlice')).toBeTruthy()
    expect(screen.getByText('studio/server.ts')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'I understand — apply unverified upgrade' }))
    await waitFor(() => expect(api.applyHarnessSourceUpgrade).toHaveBeenCalledWith(
      'aq-1', 'digest-1', 'v0.9.35',
    ))
    await waitFor(() => expect(changed).toHaveBeenCalledOnce())
  })

  it('keeps apply disabled while the Workspace has source merge blockers', async () => {
    vi.mocked(api.getHarnessSourceUpgradePlan).mockResolvedValue({
      ...plan,
      blocked: true,
      blockers: ['working_tree_changes'],
    })
    render(<WorkspaceSourceUpgradePanel wsId="aq-1" onWorkspaceChanged={vi.fn()} />)
    expect(await screen.findByText('Commit or discard working-tree changes first.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'I understand — apply unverified upgrade' }) as HTMLButtonElement).disabled).toBe(true)
  })
})

it('retains the last plan after failed refresh and does not retry by reopening', async () => {
  const props = { wsId: 'aq-1', onWorkspaceChanged: vi.fn() }
  const first = render(<WorkspaceSourceUpgradePanel {...props} />)
  await screen.findByText('studio/server.ts')
  vi.mocked(api.getHarnessSourceUpgradePlan).mockRejectedValueOnce(new Error('preview unavailable'))
  fireEvent.click(screen.getByRole('button', { name: 'Refresh preview' }))
  await screen.findByText('preview unavailable')
  expect(screen.getByText('studio/server.ts')).toBeTruthy()
  expect((screen.getByRole('button', { name: 'I understand — apply unverified upgrade' }) as HTMLButtonElement).disabled).toBe(true)
  first.unmount()
  render(<WorkspaceSourceUpgradePanel {...props} />)
  expect(screen.getByText('preview unavailable')).toBeTruthy()
  expect(api.getHarnessSourceUpgradePlan).toHaveBeenCalledTimes(2)
})

it('disables a completed cached source plan when reopened', async () => {
  vi.mocked(api.getHarnessSourceUpgradePlan).mockResolvedValue({ ...plan, fromVersion: plan.toVersion, fromCommit: plan.toCommit })
  render(<WorkspaceSourceUpgradePanel wsId="aq-1" onWorkspaceChanged={vi.fn()} />)
  expect((await screen.findByRole('button', { name: 'Up to date' }) as HTMLButtonElement).disabled).toBe(true)
  expect(api.applyHarnessSourceUpgrade).not.toHaveBeenCalled()
})

it('replaces a stale source digest with the backend conflict plan without another GET', async () => {
  const replacement = { ...plan, planDigest: 'new-digest', blocked: true, blockers: ['working_tree_changes'] }
  vi.mocked(api.applyHarnessSourceUpgrade).mockRejectedValueOnce(new api.HarnessSourceUpgradeApiError('stale_plan', 'Review changed source', 409, replacement))
  render(<WorkspaceSourceUpgradePanel wsId="aq-1" onWorkspaceChanged={vi.fn()} />)
  fireEvent.click(await screen.findByRole('button', { name: 'I understand — apply unverified upgrade' }))
  await screen.findByText('Review changed source')
  expect(planStore.peek({ workspaceId: 'aq-1', kind: 'source' })?.planDigest).toBe('new-digest')
  expect(api.getHarnessSourceUpgradePlan).toHaveBeenCalledOnce()
  expect((screen.getByRole('button', { name: 'I understand — apply unverified upgrade' }) as HTMLButtonElement).disabled).toBe(true)
})
