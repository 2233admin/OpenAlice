// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import '../../i18n'
import { SessionControlPanel } from './SessionControlPanel'
it('saves the configured cooldown through the shared control hook', () => {
  const configure = vi.fn(async () => {})
  render(<SessionControlPanel control={{ data: { execution: null, blocks: [], cooldownSeconds: 600, serverNow: Date.now() }, error: null, busy: false, configure, interrupt: vi.fn(), release: vi.fn() }} />)
  fireEvent.click(screen.getByText('Interruption cooldown'))
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Seconds' }), { target: { value: '120' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(configure).toHaveBeenCalledWith(120)
})
