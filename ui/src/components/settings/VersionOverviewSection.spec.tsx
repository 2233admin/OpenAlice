// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ updates: {} as any, workspaces: [] as any[], openAgentConfig: vi.fn(), install: vi.fn(async () => {}), probe: vi.fn(async () => {}), generation: 0 }))
vi.mock('../../hooks/useUpdateLifecycle', () => ({ useUpdateLifecycle: () => mocks.updates }))
vi.mock('../../hooks/useAliceProject', () => ({ useAliceProject: () => ({ project: { displayName: 'Main Cloud' } }) }))
vi.mock('../../contexts/workspaces-context', () => ({ useWorkspaces: () => ({ workspaces: mocks.workspaces, openAgentConfig: mocks.openAgentConfig, hasLoaded: true }) }))
vi.mock('../../auth/backendConnection', () => ({ getBackendConnection: () => ({ kind: 'local' }) }))
vi.mock('../../auth/AuthContext', () => ({ useBackendRecoverySignal: () => ({ backendUnavailable: false, backendRecoveryGeneration: mocks.generation }) }))
import '../../i18n'
import { i18n } from '../../i18n'
import { WorkspacePlanStore } from '../../lib/updates/workspacePlans'
import { VersionOverviewSection } from './VersionOverviewSection'
beforeAll(async () => { await i18n.changeLanguage('en') })
beforeEach(() => {
  mocks.generation = 0
  mocks.workspaces = [{ id: 'aq', tag: 'Quant', template: 'auto-quant-v2', currentVersion: '0.8.31', upgradeAvailable: { from: '0.8.31', to: '0.8.32' } }]
  mocks.updates = {
    machines: { status: { target: { machine: 'cloud', machineName: 'Railway Linux', project: 'main-cloud' } }, plan: null, operation: null, probe: mocks.probe, clearPlan: vi.fn(), applying: false },
    client: { kind: 'cli', currentVersion: '0.94.1', discovery: { value: { status: 'current', channel: 'stable' } } },
    versionInfo: { current: '0.93.1', latest: '0.94.1', hasUpdate: true, channel: 'stable', updateAuthority: 'cli' },
    workspacePlans: new WorkspacePlanStore(), workspaceStates: [], availableCount: 2,
    guidance: { app: false, backend: true, workspaceIds: ['aq'], needsAttentionWorkspaceIds: [], availableCount: 2, needsAttentionCount: 0 },
    installClient: mocks.install, refresh: vi.fn(async () => {}), openClientRelease: vi.fn(async () => {}),
  }
})
afterEach(() => { cleanup(); vi.clearAllMocks(); Reflect.deleteProperty(window, 'openAlice') })
it('keeps three identities separate and project content has its own versions', () => {
  render(<VersionOverviewSection />)
  expect(screen.getByRole('heading', { name: 'App' })).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Backend' })).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'AliceProject' })).toBeTruthy()
  expect(screen.getByText('v0.8.31')).toBeTruthy()
  expect(screen.getByText('v0.8.32')).toBeTruthy()
  expect(screen.getByText('Main Cloud')).toBeTruthy()
})
it('traces an update from the overview summary to its Workspace row', () => {
  render(<VersionOverviewSection />)
  const target = screen.getByRole('button', { name: 'AliceProject / Quant' })
  fireEvent.click(target)
  expect(document.activeElement?.id).toBe('settings-version-workspace-aq')
})
it('moves details to review in one focus scope without installing', async () => {
  render(<VersionOverviewSection />)
  fireEvent.click(screen.getByRole('button', { name: 'Backend · Details' }))
  expect(await screen.findByRole('dialog')).toBeTruthy()
  expect(screen.getByText('Not reported separately')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Back to updates' }))
  expect(screen.getAllByRole('dialog')).toHaveLength(1)
  expect(mocks.install).not.toHaveBeenCalled()
})
it('requires review and explicit confirmation before native restart', async () => {
  mocks.updates.nativeReady = { phase: 'downloaded', version: '0.94.2' }
  render(<VersionOverviewSection />)
  fireEvent.click(screen.getByRole('button', { name: 'App · Details' }))
  fireEvent.click((await screen.findByRole('dialog')).querySelector('button:last-child')!)
  expect(mocks.install).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Restart and update' }))
  await waitFor(() => expect(mocks.install).toHaveBeenCalledOnce())
  expect(screen.getAllByRole('dialog')).toHaveLength(1)
})
it('hands Workspace review to the existing merge owner without applying', () => {
  render(<VersionOverviewSection />)
  fireEvent.click(screen.getByRole('button', { name: /Quant.*v0.8.31/ }))
  expect(mocks.openAgentConfig).toHaveBeenCalledWith('aq', undefined, 'template')
  expect(mocks.install).not.toHaveBeenCalled()
})
it('does not label a failed check as current', () => {
  mocks.updates.clientError = 'feed offline'
  mocks.updates.versionError = 'probe offline'
  render(<VersionOverviewSection />)
  expect(screen.getAllByText('Update check failed')).toHaveLength(2)
  expect(screen.queryByText('Up to date')).toBeNull()
})

it('opens the sole Workspace update directly from Review updates', () => {
  mocks.updates.guidance.backend = false
  mocks.updates.guidance.availableCount = 1
  mocks.updates.availableCount = 1
  render(<VersionOverviewSection />)
  fireEvent.click(screen.getByRole('button', { name: 'Review updates' }))
  expect(mocks.openAgentConfig).toHaveBeenCalledWith('aq', undefined, 'template')
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(mocks.probe).not.toHaveBeenCalled()
})
it('keeps exact Workspace targets in a multi-update review', () => {
  render(<VersionOverviewSection />)
  fireEvent.click(screen.getByRole('button', { name: 'Review updates' }))
  expect(screen.getByRole('dialog').textContent).toContain('Quant')
  const quant = within(screen.getByRole('dialog')).getByText('Quant', { selector: 'p.font-medium' }).parentElement!.parentElement!
  fireEvent.click(quant.querySelector('button')!)
  expect(mocks.openAgentConfig).toHaveBeenCalledWith('aq', undefined, 'template')
})

it('keeps coordinated recovery visible instead of bypassing a pending operation', () => {
  mocks.updates.guidance.backend = false
  mocks.updates.guidance.availableCount = 1
  mocks.updates.availableCount = 1
  mocks.updates.operation = { phase: 'blocked', error: 'Reconnect the approved target', completed: {}, plan: { steps: [] } }
  mocks.updates.resume = vi.fn()
  mocks.updates.abandon = vi.fn()
  render(<VersionOverviewSection />)
  fireEvent.click(screen.getByRole('button', { name: 'Review updates' }))
  expect(screen.getByRole('dialog').textContent).toContain('Reconnect the approved target')
  expect(mocks.openAgentConfig).not.toHaveBeenCalled()
  expect(mocks.updates.resume).not.toHaveBeenCalled()
})
