// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getBackendConnection: vi.fn(),
  useAliceProject: vi.fn(),
}))

vi.mock('../auth/backendConnection', () => ({ getBackendConnection: mocks.getBackendConnection }))
vi.mock('../hooks/useAliceProject', () => ({ useAliceProject: mocks.useAliceProject }))

import '../i18n'
import { i18n } from '../i18n'
import { BackendConnectionSettingsPage } from './BackendConnectionSettingsPage'

beforeAll(async () => { await i18n.changeLanguage('en') })
afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('BackendConnectionSettingsPage', () => {
  it('keeps client-owned SSH identity separate from the backend-owned AliceProject', () => {
    mocks.getBackendConnection.mockReturnValue({
      kind: 'remote', target: 'alice@studio.example.com', sshPort: 2222,
      runtimePort: 47331, localEndpoint: '127.0.0.1:54000',
    })
    mocks.useAliceProject.mockReturnValue({
      project: { id: 'project-1', key: 'research', displayName: 'Research desk' },
      loading: false, error: null, refresh: vi.fn(),
    })

    render(<BackendConnectionSettingsPage />)
    expect(screen.getByText('alice@studio.example.com')).toBeTruthy()
    expect(screen.getByText('Research desk')).toBeTruthy()
    expect(screen.getByText('Separated mode')).toBeTruthy()
    expect(screen.queryByText('127.0.0.1:54000')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Connection details' }))
    expect(screen.getByText('127.0.0.1:54000')).toBeTruthy()
    expect(screen.getByText('project-1')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Change connection' }))
    expect(screen.getByText('Change the connection in OpenAlice CLI')).toBeTruthy()
  })

  it('shows the integrated Electron owner without implying a switch is available', () => {
    mocks.getBackendConnection.mockReturnValue({ kind: 'electron' })
    mocks.useAliceProject.mockReturnValue({
      project: null, loading: false, error: 'offline', refresh: vi.fn(),
    })

    render(<BackendConnectionSettingsPage />)
    expect(screen.getByText('Integrated mode')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Change connection' })).toBeNull()
    expect(screen.getByText('AliceProject information unavailable')).toBeTruthy()
  })
})
