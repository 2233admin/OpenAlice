/**
 * ShinkaPlugin / shinka_signal_tool — unit tests
 *
 * Strategy: call executeShinkaSignalTool directly (bypasses AI SDK overload
 * complexity). No real DuckDB file needed — warehouse doesn't exist in CI,
 * so the tool must fall back to mock data gracefully.
 */

import { describe, it, expect } from 'vitest'
import { createShinkaTools, executeShinkaSignalTool } from './signal-tool.js'
import type { ShinkaSignal } from './signal-tool.js'

// ==================== Tool object shape ====================

describe('createShinkaTools', () => {
  it('exports shinka_signal_tool with required fields', () => {
    const tools = createShinkaTools()
    const t = tools['shinka_signal_tool']
    expect(t).toBeDefined()
    expect(typeof t!.description).toBe('string')
    expect((t!.description ?? '').length).toBeGreaterThan(0)
    // inputSchema must exist (Zod schema — AI SDK v6 uses inputSchema, not parameters)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((t as any).inputSchema).toBeDefined()
  })
})

// ==================== Execute logic ====================

describe('executeShinkaSignalTool', () => {
  it('returns mock data when warehouse does not exist', async () => {
    const result = await executeShinkaSignalTool({ market: 'all', min_strength: 0 })

    expect(result.source).toBe('mock')
    expect(typeof result.reason).toBe('string')
    expect(Array.isArray(result.signals)).toBe(true)
    expect(result.count).toBe(result.signals.length)
  })

  it('every signal conforms to ShinkaSignal shape', async () => {
    const result = await executeShinkaSignalTool({ market: 'all', min_strength: 0 })

    for (const s of result.signals) {
      expect(typeof s.symbol).toBe('string')
      expect(['long', 'short', 'flat']).toContain(s.direction)
      expect(s.strength).toBeGreaterThanOrEqual(0)
      expect(s.strength).toBeLessThanOrEqual(1)
      expect(typeof s.shinka_gen).toBe('number')
      expect(s.p_risk).toBeGreaterThanOrEqual(0)
      expect(s.p_risk).toBeLessThanOrEqual(1)
      expect(typeof s.timestamp).toBe('string')
      expect(['a_share', 'crypto']).toContain(s.market)
    }
  })

  it('market filter a_share returns only a_share signals', async () => {
    const result = await executeShinkaSignalTool({ market: 'a_share', min_strength: 0 })
    for (const s of result.signals) {
      expect(s.market).toBe('a_share')
    }
  })

  it('market filter crypto returns only crypto signals', async () => {
    const result = await executeShinkaSignalTool({ market: 'crypto', min_strength: 0 })
    for (const s of result.signals) {
      expect(s.market).toBe('crypto')
    }
  })

  it('min_strength=0.8 excludes weak signals', async () => {
    const result = await executeShinkaSignalTool({ market: 'all', min_strength: 0.8 })
    for (const s of result.signals) {
      expect(s.strength).toBeGreaterThanOrEqual(0.8)
    }
  })

  it('count matches signals array length', async () => {
    const result = await executeShinkaSignalTool({ market: 'all', min_strength: 0 })
    expect(result.count).toBe(result.signals.length)
  })
})

// Satisfy TS — ShinkaSignal is used as a type only
const _typeCheck: ShinkaSignal = {
  symbol: 'TEST',
  direction: 'long',
  strength: 0.5,
  shinka_gen: 1,
  p_risk: 0.5,
  timestamp: new Date().toISOString(),
  market: 'a_share',
}
void _typeCheck
