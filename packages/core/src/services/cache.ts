/**
 * Cache abstraction — memory store with TTL support.
 *
 * Design: Simple Map-based cache with per-entry expiration.
 * No external dependencies. In production, swap with Redis
 * by implementing the same interface.
 *
 * Why Map over object: Map preserves insertion order and has
 * predictable performance for large datasets.
 */

export interface CacheEntry<T> {
  value: T
  expiresAt: number
}

export class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>()
  private nextSweepAt = 0

  // No background timer, deliberately. These singletons are constructed at
  // module scope, and Cloudflare Workers throw on setInterval in global scope
  // — a constructor timer would crash the Worker on every cold start. It also
  // pins a Node process open (the event loop never drains). Instead, expired
  // entries are swept opportunistically: get() drops stale hits, and set()
  // runs a full sweep at most once per SWEEP_INTERVAL_MS.
  private static readonly SWEEP_INTERVAL_MS = 5 * 60 * 1000

  constructor(private defaultTtlSeconds = 3600, private maxEntries = 1_000) {}

  get<T>(key: string): T | null {
    const entry = this.store.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return null
    }
    return entry.value as T
  }

  set<T>(key: string, value: T, ttlSeconds?: number): void {
    this.maybeSweep()
    const ttl = ttlSeconds ?? this.defaultTtlSeconds
    if (!this.store.has(key) && this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value
      if (oldestKey) this.store.delete(oldestKey)
    }
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttl * 1000,
    })
  }

  private maybeSweep(): void {
    const now = Date.now()
    if (now < this.nextSweepAt) return
    this.nextSweepAt = now + MemoryCache.SWEEP_INTERVAL_MS
    this.cleanup()
  }

  has(key: string): boolean {
    return this.get(key) !== null
  }

  delete(key: string): void {
    this.store.delete(key)
  }

  clear(): void {
    this.store.clear()
  }

  get size(): number {
    return this.store.size
  }

  /** Remove expired entries */
  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key)
      }
    }
  }

  destroy(): void {
    this.store.clear()
  }
}

/** Singleton cache instances */
export const sourceCache = new MemoryCache(300, 500)
export const subtitleCache = new MemoryCache(86400, 1_000)
export const tmdbCache = new MemoryCache(86400, 2_000)
