/**
 * WebhookConnector — push notifications to any incoming-webhook endpoint.
 *
 * Supports built-in payload formats for common platforms:
 *   feishu    → { msg_type: 'text', content: { text } }
 *   wecom     → { msgtype: 'text', text: { content } }
 *   dingtalk  → { msgtype: 'text', text: { content } }
 *   discord   → { content }
 *   slack     → { text }
 *   custom    → template string with {{text}} placeholder (parsed as JSON)
 */

import type { Connector, ConnectorCapabilities, SendPayload, SendResult } from '../types.js'

export type WebhookType = 'feishu' | 'wecom' | 'dingtalk' | 'discord' | 'slack' | 'custom'

export interface WebhookConnectorConfig {
  name: string
  url: string
  type: WebhookType
  /** Required when type='custom': JSON template with {{text}} placeholder */
  template?: string
}

function buildBody(type: WebhookType, text: string, template?: string): unknown {
  switch (type) {
    case 'feishu':
      return { msg_type: 'text', content: { text } }
    case 'wecom':
    case 'dingtalk':
      return { msgtype: 'text', text: { content: text } }
    case 'discord':
      return { content: text }
    case 'slack':
      return { text }
    case 'custom': {
      if (!template) throw new Error(`webhook[${type}]: custom type requires template`)
      const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
      return JSON.parse(template.replace(/\{\{text\}\}/g, escaped))
    }
  }
}

export class WebhookConnector implements Connector {
  /** Unique channel per webhook name so multiple webhooks can coexist in ConnectorCenter */
  readonly channel: string
  readonly to: string
  readonly capabilities: ConnectorCapabilities = { push: true, media: false }

  constructor(private readonly cfg: WebhookConnectorConfig) {
    this.channel = `webhook-${cfg.name}`
    this.to = cfg.name
  }

  async send(payload: SendPayload): Promise<SendResult> {
    if (!payload.text) return { delivered: false }
    try {
      const body = buildBody(this.cfg.type, payload.text, this.cfg.template)
      const res = await fetch(this.cfg.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        console.warn(`webhook[${this.cfg.name}]: HTTP ${res.status} ${res.statusText}`)
        return { delivered: false }
      }
      return { delivered: true }
    } catch (err) {
      console.error(`webhook[${this.cfg.name}]: send failed:`, err instanceof Error ? err.message : err)
      return { delivered: false }
    }
  }
}
