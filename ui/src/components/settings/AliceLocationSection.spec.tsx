// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getBackendConnection: vi.fn(),
  useAliceProject: vi.fn(),
  useRelayConnection: vi.fn(),
}))

vi.mock('../../auth/backendConnection', () => ({ getBackendConnection: mocks.getBackendConnection }))
vi.mock('../../hooks/useAliceProject', () => ({ useAliceProject: mocks.useAliceProject }))
vi.mock('../../hooks/useRelayConnection', () => ({ useRelayConnection: mocks.useRelayConnection }))

import '../../i18n'
import { i18n } from '../../i18n'
import { AliceLocationSection } from './AliceLocationSection'

beforeAll(async () => { await i18n.changeLanguage('en') })
beforeEach(() => {
  mocks.useRelayConnection.mockReturnValue({
    status: null, fleet: [], loading: false, busy: false, error: null,
    refresh: vi.fn(), connect: vi.fn(),
  })
})
afterEach(() => { cleanup(); vi.clearAllMocks(); Reflect.deleteProperty(window, 'openAlice') })

describe('AliceLocationSection', () => {
  it('keeps client-owned Machine identity separate from the backend-owned AliceProject', () => {
    mocks.getBackendConnection.mockReturnValue({
      kind: 'remote', target: 'alice@studio.example.com', sshPort: 2222,
      runtimePort: 47331, localEndpoint: '127.0.0.1:54000',
    })
    mocks.useAliceProject.mockReturnValue({
      project: { id: 'project-1', key: 'research', displayName: 'Research desk', home: '/data/research', appRoot: '/opt/openalice' },
      loading: false, error: null, refresh: vi.fn(),
    })

    render(<AliceLocationSection />)
    expect(screen.getByText('Where Alice is working')).toBeTruthy()
    expect(screen.getByText('alice@studio.example.com')).toBeTruthy()
    expect(screen.getByText('Research desk')).toBeTruthy()
    expect(screen.getByText('Connected · Remote')).toBeTruthy()
    expect(screen.queryByText('127.0.0.1:54000')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Location details' }))
    expect(screen.getByText('127.0.0.1:54000')).toBeTruthy()
    expect(screen.getByText('project-1')).toBeTruthy()
    expect(screen.getByText('research')).toBeTruthy()
    expect(screen.getByText('/data/research')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Switch location' }))
    expect(screen.getByText('Switch location in OpenAlice CLI')).toBeTruthy()
  })

  it('shows the integrated Electron owner and opens the switcher', () => {
    Object.defineProperty(window, 'openAlice', { value: {
      runtime: { info: vi.fn() },
      desktopConnection: { status: vi.fn(), fleet: vi.fn(), connect: vi.fn(), returnIntegrated: vi.fn() },
    }, configurable: true })
    mocks.getBackendConnection.mockReturnValue({ kind: 'electron' })
    mocks.useRelayConnection.mockReturnValue({
      status: { schemaVersion: 1, generation: 0, target: { machine: 'local', project: '@electron-current' }, switching: false },
      fleet: [], loading: false, busy: false, error: null, refresh: vi.fn(), connect: vi.fn(),
    })
    mocks.useAliceProject.mockReturnValue({
      project: { id: 'local-1', displayName: 'Local Alice', home: '/home/alice', appRoot: null },
      loading: false, error: null, refresh: vi.fn(),
    })

    render(<AliceLocationSection />)
    expect(screen.getByText('This machine')).toBeTruthy()
    expect(screen.getByText('Connected · Integrated mode')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Switch location' }))
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
})
