/**
 * ShinkaPlugin — registers Shinka quant signals as an AI tool group.
 *
 * Lifecycle:
 *   start(ctx) → register shinka_signal_tool into ToolCenter
 *   stop()     → deregister (no-op for now; ToolCenter has no remove API)
 */

import type { Plugin, EngineContext } from '@/core/types.js'
import { createShinkaTools } from './signal-tool.js'

export class ShinkaPlugin implements Plugin {
  readonly name = 'shinka'

  async start(ctx: EngineContext): Promise<void> {
    ctx.toolCenter.register(createShinkaTools(), 'shinka')
    console.log('shinka: signal tool registered')
  }

  async stop(): Promise<void> {
    // ToolCenter has no remove API — tools stay registered but become inert.
    console.log('shinka: plugin stopped')
  }
}
