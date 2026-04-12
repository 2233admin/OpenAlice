import type { Plugin, EngineContext } from '../../core/types.js'
import { WebhookConnector } from './webhook-connector.js'
import type { WebhookConnectorConfig } from './webhook-connector.js'

export class WebhookPlugin implements Plugin {
  readonly name: string
  private unregister?: () => void

  constructor(private readonly cfg: WebhookConnectorConfig) {
    this.name = `webhook-${cfg.name}`
  }

  async start(ctx: EngineContext): Promise<void> {
    const connector = new WebhookConnector(this.cfg)
    this.unregister = ctx.connectorCenter.register(connector)
    console.log(`webhook[${this.cfg.name}]: registered (type=${this.cfg.type})`)
  }

  async stop(): Promise<void> {
    this.unregister?.()
    this.unregister = undefined
  }
}
