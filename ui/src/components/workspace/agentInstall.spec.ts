import { describe, expect, it } from 'vitest'

import { AGENT_INSTALL, installHintFor } from './agentInstall'

describe('agent install guidance', () => {
  it('keeps every builtin guidance entry populated', () => {
    for (const hint of Object.values(AGENT_INSTALL)) {
      expect(hint.url).toMatch(/^https?:\/\//)
      expect(hint.cmd?.trim()).toBeTruthy()
    }
  })

  it('hides shell-only commands on Windows without hiding docs', () => {
    for (const agentId of ['cursor', 'agy', 'grok', 'omp']) {
      const hint = installHintFor(agentId, 'win32')
      expect(hint?.cmd).toBeUndefined()
      expect(hint?.url).toBe(AGENT_INSTALL[agentId]?.url)
    }
  })

  it('keeps npm guidance available on Windows', () => {
    for (const agentId of ['claude', 'codex', 'opencode', 'pi']) {
      expect(installHintFor(agentId, 'win32')?.cmd).toBe(AGENT_INSTALL[agentId]?.cmd)
    }
  })
})
