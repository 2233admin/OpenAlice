/**
 * shinka_execute_signal tool — unit tests
 *
 * Uses mock AccountManager + mock EventLog to verify signal→stage flow.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createShinkaExecuteTools } from './execute-tool.js'
import { signalStore } from './signal-store.js'
import type { ShinkaSignal } from './signal-tool.js'
import type { EventLog, EventLogEntry } from '@/core/event-log.js'

// ==================== Mocks ====================

function makeSignal(overrides: Partial<ShinkaSignal> = {}): ShinkaSignal {
  return {
    symbol: 'AAPL',
    direction: 'long',
    strength: 0.8,
    shinka_gen: 77,
    p_risk: 0.85,
    timestamp: new Date().toISOString(),
    market: 'a_share',
    ...overrides,
  }
}

function mockAccountManager(opts: { hasAccounts?: boolean } = {}) {
  const stagePlaceOrder = vi.fn().mockReturnValue({ staged: true, index: 0, operation: {} })

  const uta = {
    id: 'ccxt-test',
    stagePlaceOrder,
  }

  return {
    resolve: vi.fn().mockReturnValue(opts.hasAccounts === false ? [] : [uta]),
    _uta: uta,
    _stagePlaceOrder: stagePlaceOrder,
  }
}

function mockEventLog(): EventLog & { events: Array<{ type: string; payload: unknown }> } {
  const events: Array<{ type: string; payload: unknown }> = []
  return {
    events,
    append: vi.fn().mockImplementation(async (type: string, payload: unknown) => {
      events.push({ type, payload })
      return { seq: events.length, ts: Date.now(), type, payload } as EventLogEntry
    }),
    read: vi.fn(),
    query: vi.fn(),
    recent: vi.fn(),
    lastSeq: vi.fn().mockReturnValue(0),
    subscribe: vi.fn().mockReturnValue(() => {}),
    subscribeType: vi.fn().mockReturnValue(() => {}),
    close: vi.fn(),
    _resetForTest: vi.fn(),
  } as unknown as EventLog & { events: Array<{ type: string; payload: unknown }> }
}

const ALICE_ID = 'ccxt-test|AAPL'

// ==================== Tests ====================

describe('shinka_execute_signal', () => {
  let manager: ReturnType<typeof mockAccountManager>
  let eventLog: ReturnType<typeof mockEventLog>

  beforeEach(() => {
    signalStore.clear()
    manager = mockAccountManager()
    eventLog = mockEventLog()
  })

  function getExecuteFn() {
    const tools = createShinkaExecuteTools(manager as any, eventLog)
    const t = tools['shinka_execute_signal'] as any
    return t.execute as (params: Record<string, unknown>) => Promise<Record<string, unknown>>
  }

  it('returns error when no cached signal', async () => {
    const execute = getExecuteFn()
    const result = await execute({ symbol: 'AAPL', aliceId: ALICE_ID, cash_amount: 10_000 })
    expect(result.error).toContain('No cached signal')
  })

  it('skips flat signals', async () => {
    signalStore.update([makeSignal({ symbol: 'BTC/USDT', direction: 'flat' })])
    const execute = getExecuteFn()
    const result = await execute({ symbol: 'BTC/USDT', aliceId: 'ccxt-test|BTC/USDT', cash_amount: 10_000 })
    expect(result.skipped).toBe(true)
    expect(result.reason).toContain('flat')
    expect(eventLog.events).toHaveLength(1)
    expect(eventLog.events[0].type).toBe('shinka.skip')
  })

  it('stages long order with p_risk-adjusted cash', async () => {
    signalStore.update([makeSignal({ symbol: 'AAPL', direction: 'long', p_risk: 0.5 })])
    const execute = getExecuteFn()
    const result = await execute({ symbol: 'AAPL', aliceId: ALICE_ID, cash_amount: 10_000 })

    expect(result.staged).toBe(true)
    expect(result.cashAmount).toBe(5_000) // 10k * 0.5
    expect(result.originalCash).toBe(10_000)
    expect(result.direction).toBe('long')
    expect(result.side).toBe('buy')
    expect(result.p_risk).toBe(0.5)
    expect(result.commitMessage).toContain('shinka: long AAPL')

    // Verify staging was called with correct params
    expect(manager._stagePlaceOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        aliceId: ALICE_ID,
        symbol: 'AAPL',
        side: 'buy',
        type: 'MKT',
        notional: 5_000,
      }),
    )

    // Verify eventLog
    expect(eventLog.events).toHaveLength(1)
    expect(eventLog.events[0].type).toBe('shinka.staged')
  })

  it('stages short order as sell', async () => {
    signalStore.update([makeSignal({ symbol: 'AAPL', direction: 'short', p_risk: 0.8 })])
    const execute = getExecuteFn()
    const result = await execute({ symbol: 'AAPL', aliceId: ALICE_ID, cash_amount: 10_000 })

    expect(result.staged).toBe(true)
    expect(result.side).toBe('sell')
    expect(result.cashAmount).toBe(8_000) // 10k * 0.8
  })

  it('skips when p_risk zeros out cash', async () => {
    signalStore.update([makeSignal({ symbol: 'AAPL', direction: 'long', p_risk: 0 })])
    const execute = getExecuteFn()
    const result = await execute({ symbol: 'AAPL', aliceId: ALICE_ID, cash_amount: 10_000 })

    expect(result.skipped).toBe(true)
    expect(result.reason).toContain('p_risk=0')
  })

  it('returns error when no accounts available', async () => {
    signalStore.update([makeSignal({ symbol: 'AAPL' })])
    manager = mockAccountManager({ hasAccounts: false })
    const tools = createShinkaExecuteTools(manager as any, eventLog)
    const execute = (tools['shinka_execute_signal'] as any).execute

    const result = await execute({ symbol: 'AAPL', aliceId: ALICE_ID, cash_amount: 10_000 })
    expect(result.error).toContain('No trading accounts')
  })

  it('tool object has proper shape', () => {
    const tools = createShinkaExecuteTools(manager as any, eventLog)
    const t = tools['shinka_execute_signal']
    expect(t).toBeDefined()
    expect(typeof t!.description).toBe('string')
    expect((t as any).inputSchema).toBeDefined()
  })
})
