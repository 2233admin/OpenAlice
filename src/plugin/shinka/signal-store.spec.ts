import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SignalStore } from './signal-store.js'
import type { ShinkaSignal } from './signal-tool.js'

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

describe('SignalStore', () => {
  let store: SignalStore

  beforeEach(() => {
    store = new SignalStore(5000) // 5s TTL for tests
  })

  it('returns null for unknown symbol', () => {
    expect(store.get('AAPL')).toBeNull()
  })

  it('stores and retrieves signals by symbol', () => {
    const signal = makeSignal({ symbol: 'AAPL', p_risk: 0.9 })
    store.update([signal])

    const result = store.get('AAPL')
    expect(result).not.toBeNull()
    expect(result!.p_risk).toBe(0.9)
    expect(result!.symbol).toBe('AAPL')
  })

  it('updates existing signal for same symbol', () => {
    store.update([makeSignal({ symbol: 'AAPL', p_risk: 0.5 })])
    store.update([makeSignal({ symbol: 'AAPL', p_risk: 0.9 })])

    expect(store.get('AAPL')!.p_risk).toBe(0.9)
    expect(store.size).toBe(1)
  })

  it('stores multiple symbols', () => {
    store.update([
      makeSignal({ symbol: 'AAPL' }),
      makeSignal({ symbol: 'BTC/USDT', market: 'crypto' }),
    ])

    expect(store.get('AAPL')).not.toBeNull()
    expect(store.get('BTC/USDT')).not.toBeNull()
    expect(store.size).toBe(2)
  })

  it('expires signals after TTL', () => {
    const shortStore = new SignalStore(50) // 50ms TTL
    shortStore.update([makeSignal({ symbol: 'AAPL' })])

    expect(shortStore.get('AAPL')).not.toBeNull()

    // Wait for expiry
    vi.useFakeTimers()
    vi.advanceTimersByTime(100)
    expect(shortStore.get('AAPL')).toBeNull()
    vi.useRealTimers()
  })

  it('getAll returns non-expired signals', () => {
    store.update([
      makeSignal({ symbol: 'AAPL' }),
      makeSignal({ symbol: 'GOOG' }),
    ])

    const all = store.getAll()
    expect(all).toHaveLength(2)
  })

  it('getAll prunes expired entries', () => {
    const shortStore = new SignalStore(50)
    shortStore.update([makeSignal({ symbol: 'AAPL' })])

    vi.useFakeTimers()
    vi.advanceTimersByTime(100)
    expect(shortStore.getAll()).toHaveLength(0)
    expect(shortStore.size).toBe(0)
    vi.useRealTimers()
  })

  it('clear removes all signals', () => {
    store.update([makeSignal({ symbol: 'AAPL' }), makeSignal({ symbol: 'GOOG' })])
    expect(store.size).toBe(2)

    store.clear()
    expect(store.size).toBe(0)
    expect(store.get('AAPL')).toBeNull()
  })
})
