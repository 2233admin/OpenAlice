/**
 * 0007_retire_legacy_chat spec — verifies the connectors.json strip keeps
 * web while dropping the dead telegram/mcpAsk blocks, and that the
 * orphaned notifications.jsonl is deleted best-effort.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, writeFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { stripDeadConnectors, removeNotificationsLog } from './0007_retire_legacy_chat/index.js'

// ==================== In-memory config ctx ====================

/** Minimal readJson/writeJson backed by a map, mirroring the config-scoped
 *  MigrationContext surface stripDeadConnectors needs. */
function memCtx(initial: Record<string, unknown> = {}) {
  const files = new Map<string, unknown>(Object.entries(initial))
  return {
    files,
    readJson: async <T = unknown>(f: string): Promise<T | undefined> =>
      files.has(f) ? (files.get(f) as T) : undefined,
    writeJson: async (f: string, data: unknown): Promise<void> => { files.set(f, data) },
  }
}

describe('0007_retire_legacy_chat — stripDeadConnectors', () => {
  it('drops telegram + mcpAsk, keeps web', async () => {
    const ctx = memCtx({
      'connectors.json': {
        web: { port: 3000 },
        telegram: { enabled: false, botToken: '', chatIds: [] },
        mcpAsk: { enabled: false, port: null },
      },
    })
    const result = await stripDeadConnectors(ctx)
    expect(result.stripped.sort()).toEqual(['mcpAsk', 'telegram'])
    expect(ctx.files.get('connectors.json')).toEqual({ web: { port: 3000 } })
  })

  it('preserves unknown/extra keys alongside web', async () => {
    const ctx = memCtx({
      'connectors.json': {
        web: { port: 4000 },
        telegram: { enabled: true },
        future: { some: 'value' },
      },
    })
    await stripDeadConnectors(ctx)
    expect(ctx.files.get('connectors.json')).toEqual({
      web: { port: 4000 },
      future: { some: 'value' },
    })
  })

  it('is idempotent — no rewrite when already clean', async () => {
    const ctx = memCtx({ 'connectors.json': { web: { port: 3000 } } })
    let wrote = false
    const trackingCtx = {
      readJson: ctx.readJson,
      writeJson: async (f: string, data: unknown) => { wrote = true; await ctx.writeJson(f, data) },
    }
    const result = await stripDeadConnectors(trackingCtx)
    expect(result.stripped).toEqual([])
    expect(wrote).toBe(false)
  })

  it('no-ops when connectors.json is absent', async () => {
    const ctx = memCtx({})
    const result = await stripDeadConnectors(ctx)
    expect(result.stripped).toEqual([])
  })
})

describe('0007_retire_legacy_chat — removeNotificationsLog', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'migration-0007-'))
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  it('deletes the log when present', async () => {
    const logPath = join(testDir, 'notifications.jsonl')
    await writeFile(logPath, '{"id":"x","text":"old"}\n')

    const result = await removeNotificationsLog(logPath)
    expect(result.removed).toBe(true)
    await expect(stat(logPath)).rejects.toThrow()
  })

  it('is ENOENT-tolerant when the log is already gone', async () => {
    const logPath = join(testDir, 'notifications.jsonl')
    const result = await removeNotificationsLog(logPath)
    expect(result.removed).toBe(false)
  })
})
