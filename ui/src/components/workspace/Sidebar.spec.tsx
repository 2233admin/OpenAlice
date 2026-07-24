// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '../../i18n'
import type { AgentInfo, Workspace } from './api'
import { WorkspaceRow } from './Sidebar'

const capabilities = {
  parallelPerCwd: true,
  resumeLast: true,
  resumeById: true,
  transcriptDiscovery: 'none' as const,
}

const agents: readonly AgentInfo[] = [
  { id: 'pi', displayName: 'Pi', kind: 'agent', capabilities },
  { id: 'shell', displayName: 'Shell', kind: 'utility', capabilities },
]

const workspace: Workspace = {
  id: 'workspace-1',
  tag: 'chat',
  dir: '/tmp/chat',
  createdAt: '2026-07-15T00:00:00.000Z',
  agents: ['pi', 'shell'],
  sessions: [],
}

beforeEach(async () => {
  await i18n.changeLanguage('en')
})

afterEach(cleanup)

describe('WorkspaceRow session launcher', () => {
  it('keeps the default runtime one click away while the full runtime menu remains discoverable', () => {
    const onSpawn = vi.fn()
    const onSetDefaultAgent = vi.fn()
    render(
      <WorkspaceRow
        workspace={workspace}
        agents={agents}
        defaultAgent="pi"
        selection={null}
        onSelectWorkspace={vi.fn()}
        onSelectSession={vi.fn()}
        onSpawn={onSpawn}
        onOpenHeadlessRun={vi.fn()}
        onSetDefaultAgent={onSetDefaultAgent}
        onPauseSession={vi.fn()}
        onResumeSession={vi.fn()}
        onDeleteSession={vi.fn()}
        onDelete={vi.fn(async () => undefined)}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Spawn a new Pi session' }))
    expect(onSpawn).toHaveBeenCalledWith(workspace.id, { agent: 'pi' })

    fireEvent.click(screen.getByRole('button', { name: 'Choose runtime for new session' }))
    expect(screen.getByRole('menuitem', { name: 'Shell (sh)' })).toBeTruthy()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Shell (sh)' }))

    expect(onSpawn).toHaveBeenLastCalledWith(workspace.id, { agent: 'shell' })
    expect(onSetDefaultAgent).not.toHaveBeenCalled()
  })

  it('uses the primary plus button as the chooser when no default runtime exists', () => {
    render(
      <WorkspaceRow
        workspace={workspace}
        agents={agents}
        defaultAgent={null}
        selection={null}
        onSelectWorkspace={vi.fn()}
        onSelectSession={vi.fn()}
        onSpawn={vi.fn()}
        onOpenHeadlessRun={vi.fn()}
        onSetDefaultAgent={vi.fn()}
        onPauseSession={vi.fn()}
        onResumeSession={vi.fn()}
        onDeleteSession={vi.fn()}
        onDelete={vi.fn(async () => undefined)}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Choose runtime for new session' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Spawn a new session…' }))
    expect(screen.getByRole('menuitem', { name: 'Shell (sh)' })).toBeTruthy()
  })
})
