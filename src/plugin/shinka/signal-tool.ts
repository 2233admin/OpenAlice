/**
 * Shinka Signal Tool — reads today's trading signals from DuckDB warehouse.
 *
 * Falls back to mock data if the warehouse file is missing or the shinka
 * tables have not been created yet (development phase).
 */

import { tool, type Tool } from 'ai'
import { z } from 'zod'
import { access } from 'node:fs/promises'
import { signalStore } from './signal-store.js'

// ==================== Types ====================

export interface ShinkaSignal {
  symbol: string
  direction: 'long' | 'short' | 'flat'
  strength: number        // 0~1
  shinka_gen: number      // evolution generation
  p_risk: number          // 0~1, risk multiplier
  timestamp: string       // ISO8601
  market: 'a_share' | 'crypto'
}

export type ShinkaMarket = 'a_share' | 'crypto' | 'all'

// ==================== Constants ====================

const WAREHOUSE_PATH = 'E:/量化数据/warehouse.duckdb'

const MOCK_SIGNALS: ShinkaSignal[] = [
  {
    symbol: '000001.SZ',
    direction: 'long',
    strength: 0.72,
    shinka_gen: 77,
    p_risk: 0.85,
    timestamp: new Date().toISOString(),
    market: 'a_share',
  },
  {
    symbol: 'BTC/USDT',
    direction: 'flat',
    strength: 0.41,
    shinka_gen: 77,
    p_risk: 0.60,
    timestamp: new Date().toISOString(),
    market: 'crypto',
  },
]

// ==================== DuckDB helpers ====================

async function warehouseExists(): Promise<boolean> {
  try {
    await access(WAREHOUSE_PATH)
    return true
  } catch {
    return false
  }
}

/** Query shinka signals from warehouse. Returns null if tables do not exist. */
async function queryWarehouse(
  market: ShinkaMarket,
  minStrength: number,
): Promise<ShinkaSignal[] | null> {
  // Lazy import — avoids module-load failures when duckdb native addon is not built
  const { DuckDBInstance } = await import('@duckdb/node-api')

  const db = await DuckDBInstance.create(WAREHOUSE_PATH, { access_mode: 'READ_ONLY' })
  const conn = await db.connect()

  try {
    // Check if any shinka/signal tables exist
    const tableReader = await conn.runAndReadAll(
      `SELECT table_name FROM information_schema.tables
       WHERE table_name LIKE '%shinka%' OR table_name LIKE '%signal%'`,
    )
    const tableRows = tableReader.getRowObjectsJS()
    if (tableRows.length === 0) return null

    // Determine which table to use — prefer most specific name
    const tableNames = tableRows.map((r) => String(r['table_name']))
    const targetTable = tableNames.find((n) => n.includes('shinka')) ?? tableNames[0]!

    // Build WHERE clause
    const conditions: string[] = [`strength >= ${minStrength}`]
    if (market !== 'all') conditions.push(`market = '${market}'`)

    const today = new Date().toISOString().slice(0, 10)
    conditions.push(`DATE(timestamp) = '${today}'`)

    const sql = `SELECT symbol, direction, strength, shinka_gen, p_risk, timestamp, market
                 FROM ${targetTable}
                 WHERE ${conditions.join(' AND ')}
                 ORDER BY strength DESC`

    const reader = await conn.runAndReadAll(sql)
    const rows = reader.getRowObjectsJS()

    return rows.map((r) => ({
      symbol: String(r['symbol']),
      direction: String(r['direction']) as ShinkaSignal['direction'],
      strength: Number(r['strength']),
      shinka_gen: Number(r['shinka_gen']),
      p_risk: Number(r['p_risk']),
      timestamp: String(r['timestamp']),
      market: String(r['market']) as ShinkaSignal['market'],
    }))
  } finally {
    conn.closeSync()
    db.closeSync()
  }
}

// ==================== Execute logic (exported for testing) ====================

export interface ShinkaToolParams {
  market: ShinkaMarket
  min_strength: number
}

export interface ShinkaToolResult {
  source: 'warehouse' | 'mock'
  warehouse?: string
  reason?: string
  signals: ShinkaSignal[]
  count: number
}

export async function executeShinkaSignalTool(
  params: ShinkaToolParams,
): Promise<ShinkaToolResult> {
  const { market, min_strength } = params

  const filterMock = (signals: ShinkaSignal[]) =>
    signals.filter(
      (s) => (market === 'all' || s.market === market) && s.strength >= min_strength,
    )

  const exists = await warehouseExists()

  if (!exists) {
    const filtered = filterMock(MOCK_SIGNALS)
    signalStore.update(filtered)
    return { source: 'mock', reason: 'warehouse file not found', signals: filtered, count: filtered.length }
  }

  try {
    const signals = await queryWarehouse(market, min_strength)

    if (signals === null) {
      const filtered = filterMock(MOCK_SIGNALS)
      signalStore.update(filtered)
      return {
        source: 'mock',
        reason: 'shinka/signal tables not found in warehouse',
        signals: filtered,
        count: filtered.length,
      }
    }

    signalStore.update(signals)
    return { source: 'warehouse', warehouse: WAREHOUSE_PATH, signals, count: signals.length }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const filtered = filterMock(MOCK_SIGNALS)
    signalStore.update(filtered)
    return {
      source: 'mock',
      reason: `warehouse query failed: ${msg}`,
      signals: filtered,
      count: filtered.length,
    }
  }
}

// ==================== Tool factory ====================

const shinkaSignalSchema = z.object({
  market: z
    .enum(['a_share', 'crypto', 'all'])
    .default('all')
    .describe('Filter by market type'),
  min_strength: z
    .number()
    .min(0)
    .max(1)
    .default(0)
    .describe('Minimum signal strength filter (0~1)'),
})

export function createShinkaTools(): Record<string, Tool> {
  // Cast required because Zod v4 schema inference doesn't match the
  // AI SDK's internal FlexibleSchema overload selector at the type level.
  return {
    shinka_signal_tool: tool({
      description:
        "Query today's Shinka trading signals from DuckDB warehouse. " +
        'Returns signals with direction, strength, p_risk multiplier, and shinka evolution generation. ' +
        'Falls back to mock data when warehouse is unavailable (development mode).',
      inputSchema: shinkaSignalSchema,
      execute: async ({ market, min_strength }) =>
        executeShinkaSignalTool({ market: market as ShinkaMarket, min_strength }),
    }),
  }
}
