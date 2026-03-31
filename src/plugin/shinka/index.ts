/**
 * ShinkaPlugin — registers Shinka quant signal + execution tools.
 *
 * Lifecycle:
 *   start(ctx) → register shinka_signal_tool + shinka_execute_signal
 *   stop()     → clear signal store
 */

import type { Plugin, EngineContext } from '@/core/types.js'
import { createShinkaTools } from './signal-tool.js'
import { createShinkaExecuteTools } from './execute-tool.js'
import { signalStore } from './signal-store.js'

export class ShinkaPlugin implements Plugin {
  readonly name = 'shinka'

  async start(ctx: EngineContext): Promise<void> {
    ctx.toolCenter.register(createShinkaTools(), 'shinka')
    ctx.toolCenter.register(
      createShinkaExecuteTools(ctx.accountManager, ctx.eventLog),
      'shinka-execute',
    )
    console.log('shinka: signal + execute tools registered')
  }

  async stop(): Promise<void> {
    signalStore.clear()
    console.log('shinka: plugin stopped, signal store cleared')
  }
}
