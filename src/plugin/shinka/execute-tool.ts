/**
 * Shinka Execute Tool — convenience wrapper that translates a signal
 * into a staged trade order on the appropriate account.
 *
 * Flow: fetch signal → validate direction → resolve account → stage order.
 * The AI still needs to call commit() + push() to finalize.
 */

import { tool, type Tool } from 'ai'
import { z } from 'zod'
import type { AccountManager } from '@/domain/trading/account-manager.js'
import type { EventLog } from '@/core/event-log.js'
import { signalStore } from './signal-store.js'

export function createShinkaExecuteTools(
  manager: AccountManager,
  eventLog: EventLog,
): Record<string, Tool> {
  return {
    shinka_execute_signal: tool({
      description:
        'Stage a trade order based on a Shinka signal. ' +
        'Fetches the cached signal for the given symbol, calculates position size ' +
        'from p_risk and your specified cash amount, then stages the order. ' +
        'You must call commit + push afterward to execute.',
      inputSchema: z.object({
        symbol: z.string().describe('Symbol to trade (must have a cached signal)'),
        aliceId: z.string().describe('Contract aliceId from searchContracts (format: accountId|nativeKey)'),
        cash_amount: z.number().positive().describe('Cash amount to allocate (before p_risk adjustment)'),
        source: z.string().optional().describe('Account id or provider (e.g. "ccxt", "alpaca"). Omit for first available.'),
      }),
      execute: async ({ symbol, aliceId, cash_amount, source }) => {
        const signal = signalStore.get(symbol)
        if (!signal) {
          return { error: `No cached signal for ${symbol}. Call shinka_signal_tool first.` }
        }

        if (signal.direction === 'flat') {
          await eventLog.append('shinka.skip', { symbol, reason: 'flat signal', p_risk: signal.p_risk })
          return { skipped: true, reason: `Signal direction is "flat" for ${symbol} — no trade.` }
        }

        // Scale cash by p_risk
        const adjustedCash = Math.round(cash_amount * signal.p_risk * 100) / 100
        if (adjustedCash <= 0) {
          await eventLog.append('shinka.skip', { symbol, reason: 'p_risk zeroed out cash', p_risk: signal.p_risk })
          return { skipped: true, reason: `p_risk=${signal.p_risk} reduced cash to $0 for ${symbol}.` }
        }

        const targets = manager.resolve(source)
        if (targets.length === 0) {
          return { error: 'No trading accounts available.' }
        }

        const uta = targets[0]!
        const side = signal.direction === 'short' ? 'sell' : 'buy'

        try {
          const result = uta.stagePlaceOrder({
            aliceId,
            symbol,
            side: side as 'buy' | 'sell',
            type: 'MKT',
            notional: adjustedCash,
          })

          await eventLog.append('shinka.staged', {
            symbol,
            direction: signal.direction,
            cashRequested: cash_amount,
            cashAdjusted: adjustedCash,
            p_risk: signal.p_risk,
            shinka_gen: signal.shinka_gen,
            account: uta.id,
          })

          return {
            account: uta.id,
            symbol,
            direction: signal.direction,
            side,
            cashAmount: adjustedCash,
            originalCash: cash_amount,
            p_risk: signal.p_risk,
            shinka_gen: signal.shinka_gen,
            commitMessage: `shinka: ${signal.direction} ${symbol} $${adjustedCash} (gen=${signal.shinka_gen}, p_risk=${signal.p_risk.toFixed(2)})`,
            ...result,
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          return { error: `Failed to stage order: ${msg}` }
        }
      },
    }),
  }
}
