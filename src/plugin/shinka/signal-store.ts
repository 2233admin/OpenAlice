/**
 * Shared signal store — ShinkaPlugin writes, PRiskGuard reads.
 * Simple Map with TTL-based expiry.
 */

import type { ShinkaSignal } from './signal-tool.js'

const DEFAULT_TTL_MS = 5 * 60 * 1000 // 5 minutes

interface CachedSignal {
  signal: ShinkaSignal
  cachedAt: number
}

export class SignalStore {
  private signals = new Map<string, CachedSignal>()
  private ttlMs: number

  constructor(ttlMs = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs
  }

  update(signals: ShinkaSignal[]): void {
    const now = Date.now()
    for (const signal of signals) {
      this.signals.set(signal.symbol, { signal, cachedAt: now })
    }
  }

  get(symbol: string): ShinkaSignal | null {
    const entry = this.signals.get(symbol)
    if (!entry) return null
    if (Date.now() - entry.cachedAt > this.ttlMs) {
      this.signals.delete(symbol)
      return null
    }
    return entry.signal
  }

  getAll(): ShinkaSignal[] {
    const now = Date.now()
    const result: ShinkaSignal[] = []
    for (const [key, entry] of this.signals) {
      if (now - entry.cachedAt > this.ttlMs) {
        this.signals.delete(key)
      } else {
        result.push(entry.signal)
      }
    }
    return result
  }

  clear(): void {
    this.signals.clear()
  }

  get size(): number {
    return this.signals.size
  }
}

/** Module-level singleton — shared between ShinkaPlugin and PRiskGuard. */
export const signalStore = new SignalStore()
