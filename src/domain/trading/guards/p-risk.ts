/**
 * P-Risk Guard — dynamically gates trades based on Shinka signal risk.
 *
 * Reads p_risk from the shared signal store. Position size limit is
 * scaled by p_risk:
 *   p_risk=0   → blocked (below threshold)
 *   p_risk=0.5 → 12.5% of equity (half of base 25%)
 *   p_risk=1.0 → 25% of equity (full base limit)
 *
 * No signal data for a symbol → allow (don't block manual/non-shinka trades).
 */

import { UNSET_DOUBLE, UNSET_DECIMAL } from '@traderalice/ibkr'
import type { OperationGuard, GuardContext } from './types.js'
import { getOperationSymbol } from '../git/types.js'
import { signalStore } from '@/plugin/shinka/signal-store.js'

const DEFAULT_BASE_MAX_PERCENT = 25
const DEFAULT_BLOCK_THRESHOLD = 0.1

export class PRiskGuard implements OperationGuard {
  readonly name = 'p-risk'
  private baseMaxPercent: number
  private blockThreshold: number

  constructor(options: Record<string, unknown>) {
    this.baseMaxPercent = Number(options.baseMaxPercent ?? DEFAULT_BASE_MAX_PERCENT)
    this.blockThreshold = Number(options.blockThreshold ?? DEFAULT_BLOCK_THRESHOLD)
  }

  check(ctx: GuardContext): string | null {
    if (ctx.operation.action !== 'placeOrder') return null

    const symbol = getOperationSymbol(ctx.operation)
    const signal = signalStore.get(symbol)

    // No signal → allow (manual trade or non-shinka symbol)
    if (!signal) return null

    const pRisk = signal.p_risk

    // Hard block below threshold
    if (pRisk < this.blockThreshold) {
      return `P_risk ${pRisk.toFixed(2)} below threshold ${this.blockThreshold} for ${symbol}`
    }

    // Dynamic position limit: baseMaxPercent * p_risk
    const effectiveMaxPercent = this.baseMaxPercent * pRisk

    const { positions, account, operation } = ctx
    const existing = positions.find(p => p.contract.symbol === symbol)
    const currentValue = existing?.marketValue ?? 0

    const { order } = operation
    const cashQty = order.cashQty !== UNSET_DOUBLE ? order.cashQty : undefined
    const qty = !order.totalQuantity.equals(UNSET_DECIMAL) ? order.totalQuantity.toNumber() : undefined

    let addedValue = 0
    if (cashQty && cashQty > 0) {
      addedValue = cashQty
    } else if (qty && existing) {
      addedValue = qty * existing.marketPrice
    }

    // Can't estimate → allow (broker will validate)
    if (addedValue === 0) return null

    const projectedValue = currentValue + addedValue
    const percent = account.netLiquidation > 0
      ? (projectedValue / account.netLiquidation) * 100
      : 0

    if (percent > effectiveMaxPercent) {
      return `P_risk-adjusted limit: ${symbol} would be ${percent.toFixed(1)}% of equity (p_risk=${pRisk.toFixed(2)}, limit: ${effectiveMaxPercent.toFixed(1)}%)`
    }

    return null
  }
}
