/**
 * ShinkaPlugin — registers Shinka quant signal + execution tools.
 *
 * Lifecycle:
 *   start(ctx) → register shinka_signal_tool + shinka_execute_signal + start sync scheduler
 *   stop()     → stop sync scheduler + clear signal store
 */

import type { Plugin, EngineContext } from '@/core/types.js'
import { createShinkaTools } from './signal-tool.js'
import { createShinkaExecuteTools } from './execute-tool.js'
import { createShinkaSyncScheduler, type ShinkaSyncScheduler } from './sync-scheduler.js'
import { signalStore } from './signal-store.js'

export class ShinkaPlugin implements Plugin {
  readonly name = 'shinka'

  private syncScheduler: ShinkaSyncScheduler | null = null

  async start(ctx: EngineContext): Promise<void> {
    ctx.toolCenter.register(createShinkaTools(), 'shinka')
    ctx.toolCenter.register(
      createShinkaExecuteTools(ctx.accountManager, ctx.eventLog),
      'shinka-execute',
    )

    this.syncScheduler = createShinkaSyncScheduler({
      accountManager: ctx.accountManager,
      cronEngine: ctx.cronEngine,
      eventLog: ctx.eventLog,
      connectorCenter: ctx.connectorCenter,
      config: { enabled: true, every: '30s' },
    })
    await this.syncScheduler.start()

    console.log('shinka: signal + execute tools registered')
  }

  async stop(): Promise<void> {
    this.syncScheduler?.stop()
    this.syncScheduler = null
    signalStore.clear()
    console.log('shinka: plugin stopped, signal store cleared')
  }
}
