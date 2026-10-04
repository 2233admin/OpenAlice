/**
 * News Collector — RSS fetch service
 *
 * A code-level setInterval service (not AI-driven cron) that periodically
 * fetches configured RSS feeds and ingests new items into the store.
 */

import { fetchAndParseFeed } from './rss-parser.js'
import { computeDedupKey, type NewsCollectorStore } from '../store.js'
import type { RSSFeedConfig } from '../types.js'
import type { NewsRecord } from '../types.js'
import { DEFAULT_RSSHUB_BASE_URL, resolveNewsFeedUrl } from '../config.js'

interface FeedHealth {
  state: 'never_attempted' | 'checking' | 'healthy' | 'error'
  lastAttemptAt: number | null
  lastSuccessAt: number | null
  lastItemCount: number | null
  lastNewItemCount: number | null
  lastError: string | null
}

function initialHealth(): FeedHealth {
  return { state: 'never_attempted', lastAttemptAt: null, lastSuccessAt: null, lastItemCount: null, lastNewItemCount: null, lastError: null }
}

function healthIdentity(feed: RSSFeedConfig, baseUrl: string): string {
  return JSON.stringify([feed.id ?? null, feed.source, resolveNewsFeedUrl(feed, baseUrl)])
}

export interface CollectorOpts {
  store: NewsCollectorStore
  feeds: RSSFeedConfig[]
  intervalMs: number
  rsshubBaseUrl?: string
  enabled?: boolean
  /** Optional product activity sink installed by the composition root. */
  onIngested?: (record: NewsRecord) => void | Promise<void>
}

export class NewsCollector {
  private timer: ReturnType<typeof setInterval> | null = null
  private store: NewsCollectorStore
  private feeds: RSSFeedConfig[]
  private intervalMs: number
  private onIngested?: (record: NewsRecord) => void | Promise<void>
  private rsshubBaseUrl: string
  private enabled: boolean
  private configurationChain: Promise<void> = Promise.resolve()
  private health = new Map<RSSFeedConfig, FeedHealth>()
  /**
   * In-flight guard: if a fetchAll is already running when the next interval
   * tick fires, share the existing promise instead of starting a second pass.
   * Prevents duplicate HTTP work when network latency exceeds intervalMs.
   */
  private fetchInFlight: Promise<{ total: number; new: number }> | null = null

  constructor(opts: CollectorOpts) {
    this.store = opts.store
    this.feeds = opts.feeds
    this.intervalMs = opts.intervalMs
    this.onIngested = opts.onIngested
    this.rsshubBaseUrl = opts.rsshubBaseUrl ?? DEFAULT_RSSHUB_BASE_URL
    this.enabled = opts.enabled ?? true
  }

  /** Serialize edits with collection so old requests finish before new config is installed. */
  configure(opts: Pick<CollectorOpts, 'feeds' | 'intervalMs' | 'rsshubBaseUrl'> & { enabled: boolean }): Promise<void> {
    const next = this.configurationChain.catch(() => {}).then(async () => {
      this.stop()
      await this.fetchInFlight
      const previous = new Map<string, FeedHealth | null>()
      for (const feed of this.feeds) {
        const key = healthIdentity(feed, this.rsshubBaseUrl)
        previous.set(key, previous.has(key) ? null : this.health.get(feed) ?? initialHealth())
      }
      this.feeds = opts.feeds
      this.intervalMs = opts.intervalMs
      this.rsshubBaseUrl = opts.rsshubBaseUrl ?? DEFAULT_RSSHUB_BASE_URL
      this.enabled = opts.enabled
      this.health.clear()
      const identities = this.feeds.map((feed) => healthIdentity(feed, this.rsshubBaseUrl))
      const counts = new Map<string, number>()
      for (const key of identities) counts.set(key, (counts.get(key) ?? 0) + 1)
      for (let i = 0; i < this.feeds.length; i++) {
        const key = identities[i]
        // Ambiguous legacy duplicates cannot safely inherit another row's history.
        const prior = counts.get(key) === 1 ? previous.get(key) : null
        this.health.set(this.feeds[i], prior ?? initialHealth())
      }
      if (this.enabled) this.start()
    })
    this.configurationChain = next
    return next
  }

  /** Process-local diagnostics; collection history is not persisted. */
  getStatus() {
    return this.feeds.map((feed) => ({
      ...this.health.get(feed) ?? initialHealth(),
      id: feed.id,
      name: feed.name,
      source: feed.source,
      url: resolveNewsFeedUrl(feed, this.rsshubBaseUrl),
      state: !this.enabled || feed.enabled === false ? 'disabled' as const : (this.health.get(feed)?.state ?? 'never_attempted'),
    }))
  }

  /** Start periodic collection. Fetches immediately, then at interval. */
  start(): void {
    if (!this.enabled || this.timer) return
    this.fetchAll().catch((err) =>
      console.warn(`news-collector: initial fetch failed: ${err instanceof Error ? err.message : err}`),
    )
    this.timer = setInterval(
      () => this.fetchAll().catch((err) =>
        console.warn(`news-collector: periodic fetch failed: ${err instanceof Error ? err.message : err}`),
      ),
      this.intervalMs,
    )
  }

  /** Stop periodic collection. */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  /**
   * Fetch all active feeds once. Disabled feeds are skipped. Returns counts.
   *
   * Concurrent calls share the in-flight promise (no overlapping fetch passes).
   */
  async fetchAll(): Promise<{ total: number; new: number }> {
    await this.configurationChain
    if (!this.enabled) return { total: 0, new: 0 }
    if (this.fetchInFlight) return this.fetchInFlight
    this.fetchInFlight = this._fetchAllImpl()
    try {
      return await this.fetchInFlight
    } finally {
      this.fetchInFlight = null
    }
  }

  private async _fetchAllImpl(): Promise<{ total: number; new: number }> {
    let totalItems = 0
    let totalNew = 0

    const activeFeeds = this.feeds.filter((f) => f.enabled !== false)

    for (const feed of activeFeeds) {
      const health = this.health.get(feed) ?? initialHealth()
      this.health.set(feed, health)
      health.state = 'checking'
      health.lastAttemptAt = Date.now()
      try {
        const { fetched, ingested } = await this.fetchFeed(feed)
        totalItems += fetched
        totalNew += ingested
        health.state = 'healthy'
        health.lastSuccessAt = Date.now()
        health.lastItemCount = fetched
        health.lastNewItemCount = ingested
        health.lastError = null
      } catch (err) {
        health.state = 'error'
        // Do not expose request URLs, query parameters or upstream response bodies.
        health.lastError = err instanceof Error && /^RSS (fetch|response) failed:/.test(err.message)
          ? err.message : 'Feed request, parsing or ingestion failed'
        console.warn(
          `news-collector: failed to fetch ${feed.name} (${resolveNewsFeedUrl(feed, this.rsshubBaseUrl)}): ${err instanceof Error ? err.message : err}`,
        )
      }
    }

    if (totalNew > 0) {
      console.log(
        `news-collector: fetched ${totalItems} items from ${activeFeeds.length} active feeds, ${totalNew} new`,
      )
    }

    return { total: totalItems, new: totalNew }
  }

  /** Fetch a single feed and ingest its items. */
  private async fetchFeed(feed: RSSFeedConfig): Promise<{ fetched: number; ingested: number }> {
    const items = await fetchAndParseFeed(resolveNewsFeedUrl(feed, this.rsshubBaseUrl), 1, Boolean(feed.rsshubRoute))
    let ingested = 0

    for (const item of items) {
      const dedupKey = computeDedupKey({
        guid: item.guid ?? undefined,
        link: item.link ?? undefined,
        title: item.title,
        content: item.content,
      })

      const record = await this.store.ingestRecord({
        title: item.title,
        content: item.content,
        pubTime: item.pubDate ?? new Date(),
        dedupKey,
        metadata: {
          source: feed.source,
          link: item.link,
          guid: item.guid,
          ingestSource: 'rss',
          dedupKey,
          ...(feed.categories ? { categories: feed.categories.join(',') } : {}),
          ...(item.image ? { image: item.image } : {}),
        },
      })

      if (record) {
        ingested++
        await this.onIngested?.(record)
      }
    }

    return { fetched: items.length, ingested }
  }
}
