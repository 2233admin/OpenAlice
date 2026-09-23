// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import '../../i18n'
import { RunningSessionGroup } from './RunningSessionGroup'
import type { HarnessSession } from './harness-sessions'

afterEach(() => { cleanup(); vi.useRealTimers() })

it('shows a live duration from the active headless execution and keeps the row selectable', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-23T00:00:00.000Z'))
  const onSelect = vi.fn()
  const row = {
    resumeId: 'scan', title: 'Scan Open', session: { agent: 'claude' },
    directory: { latestExecution: { status: 'running', startedAt: Date.now() - 65_000 } },
  } as HarnessSession
  const view = render(<RunningSessionGroup sessions={[row]} onSelect={onSelect} />)
  fireEvent.click(screen.getByRole('button', { name: '1 running' }))
  expect(screen.getByRole('button', { name: 'Scan Open' }).getAttribute('aria-description')).toBe('Running for 1:05')
  act(() => vi.advanceTimersByTime(2_000))
  const running = screen.getByRole('button', { name: 'Scan Open' })
  expect(running.getAttribute('aria-description')).toBe('Running for 1:07')
  fireEvent.click(running)
  expect(onSelect).toHaveBeenCalledWith(row)
  view.rerender(<RunningSessionGroup sessions={[]} onSelect={onSelect} />)
  expect(screen.queryByRole('button', { name: /Scan Open/ })).toBeNull()
})
