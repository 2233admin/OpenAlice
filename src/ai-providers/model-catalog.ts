/** Project-owned provider catalogs. Reads never wait for provider I/O. */
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'
import { dataPath } from '../core/paths.js'
import { discoverModels, type modelDiscoveryInput } from './model-discovery.js'
import { PRESET_CATALOG, type ModelOption } from './preset-catalog.js'
import { resolveModelSemantics } from './model-semantics.js'

export const MODEL_CATALOG_TTL_MS = 24 * 60 * 60 * 1000
const RETRY_DELAY_MS = 60_000
const snapshotSchema = z.object({
  version: z.literal(1), identity: z.string(), fetchedAt: z.number().finite().nonnegative(),
  models: z.array(z.object({ id: z.string().min(1).max(512), label: z.string() })),
})
type Snapshot = z.infer<typeof snapshotSchema>
type DiscoveryInput = z.infer<typeof modelDiscoveryInput>
export interface CatalogAccess { slug: string; vendor: string; input: DiscoveryInput }
export interface ProviderModelCatalog {
  models: ModelOption[]
  source: 'bundled' | 'snapshot'
  fetchedAt: number | null
  refreshing: boolean
  error: string | null
}
interface Entry {
  identity: string
  ready: Promise<void>
  snapshot?: Snapshot
  pending?: Promise<void>
  attemptedAt?: number
  error: string | null
}
const presetIds: Record<string, string> = {
  anthropic: 'claude-api', openai: 'codex-api', google: 'gemini', xai: 'xai-api',
  openrouter: 'openrouter', minimax: 'minimax', glm: 'glm', kimi: 'kimi',
  deepseek: 'deepseek', longcat: 'longcat',
}
function seedModels(vendor: string): ModelOption[] {
  return [...(PRESET_CATALOG.find((preset) => preset.id === presetIds[vendor])?.models ?? [])]
}
const digest = (value: string) => createHash('sha256').update(value).digest('hex')

export class ProviderModelCatalogStore {
  private readonly entries = new Map<string, Entry>()
  constructor(private readonly options: {
    directory?: string
    discover?: typeof discoverModels
    now?: () => number
  } = {}) {}

  async read(access: CatalogAccess, force = false): Promise<ProviderModelCatalog> {
    const directory = this.options.directory ?? dataPath('model-catalog', 'providers')
    // Each endpoint/protocol has its own catalog. Never share account-filtered
    // results across keys, or reveal a key/endpoint in the filename or response.
    const slot = digest(JSON.stringify([access.slug, access.input.wireShape]))
    const identity = digest(JSON.stringify([access.vendor, access.input.wireShape, access.input.baseUrl ?? '', access.input.apiKey]))
    const file = join(directory, `${slot}.json`)
    let entry = this.entries.get(slot)
    if (!entry || entry.identity !== identity) {
      const created: Entry = { identity, ready: Promise.resolve(), error: null }
      created.ready = readFile(file, 'utf8').then((raw) => {
        const parsed = snapshotSchema.safeParse(JSON.parse(raw))
        if (parsed.success && parsed.data.identity === identity) created.snapshot = parsed.data
      }).catch(() => { /* Missing/corrupt caches are rebuilt; never block startup. */ })
      this.entries.set(slot, created)
      entry = created
    }
    await entry.ready
    const now = this.options.now ?? Date.now
    const age = entry.snapshot ? now() - entry.snapshot.fetchedAt : Infinity
    const stale = age < 0 || age >= MODEL_CATALOG_TTL_MS
    if (!entry.pending && (force || (stale && (entry.attemptedAt === undefined || now() - entry.attemptedAt >= RETRY_DELAY_MS)))) {
      const target = entry
      target.attemptedAt = now()
      target.error = null
      target.pending = (async () => {
        let temp: string | undefined
        try {
          const models = await (this.options.discover ?? discoverModels)(access.input)
          const snapshot = snapshotSchema.parse({ version: 1, identity, fetchedAt: now(), models })
          if (this.entries.get(slot) !== target) return
          await mkdir(directory, { recursive: true, mode: 0o700 })
          temp = `${file}.${randomUUID()}.tmp`
          await writeFile(temp, JSON.stringify(snapshot) + '\n', { mode: 0o600 })
          if (this.entries.get(slot) !== target) return
          await rename(temp, file)
          target.snapshot = snapshot
        } catch {
          // Provider failures can include credentials. Keep the last successful
          // list and return only a fixed diagnostic suitable for the UI.
          target.error = 'Could not refresh models; keeping the previous catalog.'
        } finally {
          if (temp) await rm(temp, { force: true }).catch(() => undefined)
          target.pending = undefined
        }
      })()
    }
    // Explicit refresh waits; ordinary GET immediately serves local data while
    // its single-flight update runs. A failed refresh retains the timestamp.
    if (force) await entry.pending
    const models = entry.snapshot?.models ?? seedModels(access.vendor)
    return {
      models: models.map((model) => {
        const semantics = resolveModelSemantics(access.vendor, model.id)
        return { ...model, ...(semantics ? { semantics } : {}) }
      }),
      source: entry.snapshot ? 'snapshot' : 'bundled',
      fetchedAt: entry.snapshot?.fetchedAt ?? null,
      refreshing: !!entry.pending,
      error: entry.error,
    }
  }
}

export const providerModelCatalog = new ProviderModelCatalogStore()
