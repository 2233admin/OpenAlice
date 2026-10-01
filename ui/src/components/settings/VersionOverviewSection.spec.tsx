// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ updates: {} as any, workspaces: [] as any[], openAgentConfig: vi.fn(), install: vi.fn(async () => {}), probe: vi.fn(async () => {}), generation: 0, setup: null as any }))
vi.mock('../../hooks/useUpdateLifecycle', () => ({ useUpdateLifecycle: () => mocks.updates }))
vi.mock('../../hooks/useProjectWorkspaceSetup', async importOriginal => ({ ...await importOriginal<any>(), useSharedProjectWorkspaceSetup: () => mocks.setup }))
vi.mock('../../hooks/useAliceProject', () => ({ useAliceProject: () => ({ project: { displayName: 'Main Cloud' } }) }))
vi.mock('../../contexts/workspaces-context', () => ({ useWorkspaces: () => ({ workspaces: mocks.workspaces, openAgentConfig: mocks.openAgentConfig, hasLoaded: true }) }))
vi.mock('../../auth/backendConnection', () => ({ getBackendConnection: () => ({ kind: 'local' }) }))
vi.mock('../../auth/AuthContext', () => ({ useBackendRecoverySignal: () => ({ backendUnavailable: false, backendRecoveryGeneration: mocks.generation }) }))
import '../../i18n'
import { i18n } from '../../i18n'
import { VersionOverviewSection } from './VersionOverviewSection'
beforeAll(async () => { await i18n.changeLanguage('en') })
beforeEach(() => {
  mocks.generation = 0
  mocks.setup = null
  mocks.workspaces = [{ id: 'aq', tag: 'Quant', template: 'auto-quant-v2', currentVersion: '0.8.31', upgradeAvailable: { from: '0.8.31', to: '0.8.32' } }]
  mocks.updates = {
    machines: { status: { target: { machine: 'cloud', machineName: 'Railway Linux', project: 'main-cloud' } }, plan: null, operation: null, probe: mocks.probe, clearPlan: vi.fn(), applying: false },
    client: { kind: 'cli', currentVersion: '0.94.1', discovery: { value: { status: 'current', channel: 'stable' } } },
    versionInfo: { current: '0.93.1', latest: '0.94.1', hasUpdate: true, channel: 'stable', updateAuthority: 'cli' },
    workspaceStates: [], availableCount: 2,
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

it('offers concrete preparation recovery even before any Workspace exists', async () => {
  mocks.workspaces = []
  mocks.setup = { setup: { phase: 'complete', pending: ['auto-quant'], errors: { 'auto-quant': 'Clone unavailable' } }, error: null, busy: false, retry: vi.fn() }
  const { rerender } = render(<VersionOverviewSection />)
  fireEvent.click(screen.getByRole('button', { name: 'AliceProject / Auto Quant' }))
  expect(document.activeElement?.id).toBe('settings-version-setup-auto-quant')
  expect(screen.getByText('Clone unavailable')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(mocks.setup.retry).toHaveBeenCalledOnce()
  expect(mocks.openAgentConfig).not.toHaveBeenCalled()
  mocks.setup.busy = true
  rerender(<VersionOverviewSection />)
  expect(screen.getByRole('button', { name: 'Preparing…' }).hasAttribute('disabled')).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'AliceProject · Details' }))
  expect(await screen.findByRole('dialog')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Back to updates' }))
  fireEvent.click(screen.getAllByRole('button', { name: 'Close' }).at(-1)!)
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  mocks.setup = { ...mocks.setup, busy: false, setup: { phase: 'complete', pending: [] } }
  rerender(<VersionOverviewSection />)
  expect(screen.queryByText('Clone unavailable')).toBeNull()
  expect(screen.queryByRole('button', { name: 'AliceProject / Auto Quant' })).toBeNull()
})
it('keeps loading and preparation quiet, but exposes status-read failures', () => {
  mocks.workspaces = []
  mocks.setup = { setup: null, error: null, busy: false, retry: vi.fn() }
  const { rerender } = render(<VersionOverviewSection />)
  expect(screen.queryByText(/Preparation failed/)).toBeNull()
  mocks.setup.setup = { phase: 'preparing', pending: ['chat'], errors: { chat: 'previous attempt' } }
  rerender(<VersionOverviewSection />)
  expect(screen.queryByText('previous attempt')).toBeNull()
  mocks.setup.error = 'Status unavailable'
  rerender(<VersionOverviewSection />)
  expect(screen.getByText('Status unavailable')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'AliceProject / Workspace preparation' }))
  expect(document.activeElement?.id).toBe('settings-version-setup-status')
})
