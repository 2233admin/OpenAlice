/**
 * ShinkaSyncScheduler — cron-based order sync + trade notifications.
 *
 * Every interval (default 30s):
 *   1. Calls uta.sync() for all registered accounts
 *   2. On fill/reject detected → broadcasts via ConnectorCenter + emits to EventLog
 *
 * Pattern mirrors src/domain/trading/snapshot/scheduler.ts.
 */

import type { EventLog, EventLogEntry } from '@/core/event-log.js'
import type { CronEngine, CronFirePayload } from '@/task/cron/engine.js'
import type { AccountManager } from '@/domain/trading/account-manager.js'
import type { ConnectorCenter } from '@/core/connector-center.js'

const SYNC_JOB_NAME = '__shinka_sync__'
const DEFAULT_INTERVAL = '30s'

export interface ShinkaSyncConfig {
  enabled: boolean
  every?: string
}

export interface ShinkaSyncScheduler {
  start(): Promise<void>
  stop(): void
}

export function createShinkaSyncScheduler(deps: {
  accountManager: AccountManager
  cronEngine: CronEngine
  eventLog: EventLog
  connectorCenter: ConnectorCenter
  config: ShinkaSyncConfig
}): ShinkaSyncScheduler {
  const { accountManager, cronEngine, eventLog, connectorCenter, config } = deps

  let unsubscribe: (() => void) | null = null
  let running = false

  async function handleFire(entry: EventLogEntry): Promise<void> {
    const payload = entry.payload as CronFirePayload
    if (payload.jobName !== SYNC_JOB_NAME) return
    if (running) return

    running = true
    try {
      const accounts = accountManager.resolve()
      for (const uta of accounts) {
        try {
          const result = await uta.sync()
          if (result.updatedCount === 0) continue

          for (const update of result.updates) {
            const { symbol, currentStatus, filledQty, filledPrice } = update

            if (currentStatus === 'filled') {
              const qtyStr = filledQty != null ? String(filledQty) : '?'
              const priceStr = filledPrice != null ? `@${filledPrice}` : ''
              const msg = `[OpenAlice] FILLED: ${symbol} ${qtyStr}${priceStr}`
              await connectorCenter.broadcast(msg)
              await eventLog.append('trade.filled', { symbol, filledQty, filledPrice, account: uta.id })
            } else if (currentStatus === 'rejected') {
              const msg = `[OpenAlice] REJECTED: ${symbol}`
              await connectorCenter.broadcast(msg)
              await eventLog.append('trade.rejected', { symbol, account: uta.id })
            } else if (currentStatus === 'cancelled') {
              await eventLog.append('trade.cancelled', { symbol, account: uta.id })
            }
          }
        } catch (err) {
          console.warn(`shinka-sync: sync failed for account ${uta.id}:`, err instanceof Error ? err.message : err)
        }
      }
    } finally {
      running = false
    }
  }

  return {
    async start() {
      const every = config.every ?? DEFAULT_INTERVAL
      const existing = cronEngine.list().find(j => j.name === SYNC_JOB_NAME)
      if (existing) {
        await cronEngine.update(existing.id, {
          schedule: { kind: 'every', every },
          enabled: config.enabled,
        })
      } else {
        await cronEngine.add({
          name: SYNC_JOB_NAME,
          schedule: { kind: 'every', every },
          payload: '',
          enabled: config.enabled,
        })
      }

      if (!unsubscribe) {
        unsubscribe = eventLog.subscribeType('cron.fire', (entry) => {
          handleFire(entry).catch(err => {
            console.error('shinka-sync: unhandled error:', err)
          })
        })
      }

      console.log(`shinka-sync: scheduler started (every=${every}, enabled=${config.enabled})`)
    },

    stop() {
      unsubscribe?.()
      unsubscribe = null
      console.log('shinka-sync: scheduler stopped')
    },
  }
}
