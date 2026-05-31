/**
 * 0007_retire_legacy_chat — clean up config orphaned by the legacy chat
 * cluster removal (ConnectorCenter + Telegram/MCP-Ask connectors +
 * NotificationsStore).
 *
 * Two orphans, two scopes:
 *
 *  1. `connectors.json` still carries dead `telegram` + `mcpAsk` blocks.
 *     The connectors config schema was slimmed to `{ web }` — `web.port`
 *     is LOAD-BEARING (the web server binds to it) and MUST stay. So this
 *     migration STRIPS the two dead keys and KEEPS web (+ any other
 *     keys). Config-scoped, so it uses the `ctx` helpers.
 *
 *  2. `data/sessions/notifications.jsonl` is the old NotificationsStore's
 *     append-only log. Nothing reads it after the store's removal. Lives
 *     outside `data/config/`, so it's deleted with raw `fs/promises`
 *     (same pattern as 0004), best-effort + ENOENT-tolerant.
 *
 * Deliberately NOT touched:
 *  - `heartbeat.json` — heartbeat's scheduler SURVIVES (its push is
 *    stubbed, but cadence/active-hours config is still read at boot).
 *    Lumping it in with the other "legacy chat" files would drop live
 *    config — the exact silent-bug class this migration guards against.
 *  - `data/cron/jobs.json` — a cron job is just `{id, jobName, payload,
 *    schedule, state}`; there is no `action`/`tool` field, so there is no
 *    structural "notify_user job" to strip. A job's payload is a generic
 *    prompt; after the rewire its reply simply lands in the Inbox.
 *
 * Idempotent: stripping no-ops when neither dead key is present; the
 * jsonl delete no-ops via ENOENT-tolerance.
 */

import { rm } from 'node:fs/promises'
import { dataPath } from '@/core/paths.js'
import type { Migration } from '../types.js'

const NOTIFICATIONS_LOG = dataPath('sessions', 'notifications.jsonl')

/**
 * Strip the dead `telegram` + `mcpAsk` keys from connectors.json, keeping
 * `web` and anything else. Exported for the spec. Returns the keys it
 * removed (empty when there was nothing to do).
 */
export async function stripDeadConnectors(ctx: {
  readJson: <T = unknown>(f: string) => Promise<T | undefined>
  writeJson: (f: string, data: unknown) => Promise<void>
}): Promise<{ stripped: string[] }> {
  const connectors = await ctx.readJson<Record<string, unknown>>('connectors.json')
  if (!connectors) return { stripped: [] } // no file yet — nothing to strip

  const DEAD_KEYS = ['telegram', 'mcpAsk'] as const
  const present = DEAD_KEYS.filter((k) => k in connectors)
  if (present.length === 0) return { stripped: [] } // already clean — no rewrite

  const cleaned: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(connectors)) {
    if ((DEAD_KEYS as readonly string[]).includes(k)) continue
    cleaned[k] = v
  }
  await ctx.writeJson('connectors.json', cleaned)
  console.log(`[migration 0007] stripped dead connector keys: ${present.join(', ')}`)
  return { stripped: [...present] }
}

/**
 * Delete the orphaned NotificationsStore log. Exported for the spec to
 * drive against a temp path. Best-effort + ENOENT-tolerant.
 */
export async function removeNotificationsLog(
  logPath: string = NOTIFICATIONS_LOG,
): Promise<{ removed: boolean }> {
  try {
    await rm(logPath, { force: false })
    console.log(`[migration 0007] removed ${logPath}`)
    return { removed: true }
  } catch (err: unknown) {
    if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { removed: false }
    }
    throw err
  }
}

export const migration: Migration = {
  id: '0007_retire_legacy_chat',
  appVersion: '0.21.0-beta.6',
  introducedAt: '2026-05-31',
  affects: ['connectors.json', 'sessions/notifications.jsonl'],
  summary:
    'Strip dead telegram/mcpAsk from connectors.json (keep web) + delete orphan notifications.jsonl after legacy chat cluster removal',
  rationale:
    'ConnectorCenter + Telegram/MCP-Ask connectors + NotificationsStore were removed. connectors.json keeps web.port (load-bearing) but its telegram/mcpAsk blocks are dead; notifications.jsonl is the orphaned NotificationsStore log. heartbeat.json is retained (scheduler survives) and cron jobs.json is untouched (no structural notify_user job exists).',
  up: async (ctx) => {
    await stripDeadConnectors(ctx)
    await removeNotificationsLog()
  },
}
