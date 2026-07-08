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
  private cleanupTimer: ReturnType<typeof setInterval> | null = null

  constructor(private defaultTtlSeconds = 3600) {
    // Clean expired entries every 5 minutes
    this.cleanupTimer = setInterval(() => this.cleanup(), 5 * 60 * 1000)
  }

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
    const ttl = ttlSeconds ?? this.defaultTtlSeconds
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttl * 1000,
    })
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
    if (this.cleanupTimer) clearInterval(this.cleanupTimer)
    this.store.clear()
  }
}

/** Singleton cache instances */
export const sourceCache = new MemoryCache(3600)     // 1 hour
export const subtitleCache = new MemoryCache(86400)   // 24 hours
export const tmdbCache = new MemoryCache(86400)       // 24 hours
