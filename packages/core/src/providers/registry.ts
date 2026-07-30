import type { IProvider, ProviderHealth, ProviderMediaObject, ProviderResult, SourceResponse, Source, Subtitle, Diagnostic } from '@spiflix/shared'
import type { BaseProvider } from './base.js'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Backstop for a provider that never settles. Deliberately generous — every
 * provider already bounds its own fetches well below this, so a healthy one
 * never reaches it. Without it, a single hung scraper holds the whole response
 * open and every other provider's sources are lost with it.
 */
const PROVIDER_TIMEOUT_MS = 20_000

/**
 * Reject if `promise` hasn't settled in time. This frees the *response*; it
 * can't cancel the provider's in-flight request (the IProvider contract takes
 * no abort signal), which just completes unobserved.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms)
    promise.then(
      value => { clearTimeout(timer); resolve(value) },
      error => { clearTimeout(timer); reject(error) },
    )
  })
}

/**
 * Providers are third-party scrapers, so treat their output as untrusted: a
 * malformed payload (missing arrays, entries with no URL) would otherwise
 * throw while tagging and take that provider's whole result down — or worse,
 * hand the player a source it can never load.
 */
function normalizeResult(result: ProviderResult | undefined): ProviderResult {
  const usable = (entry: { url?: unknown }) =>
    entry != null && typeof entry.url === 'string' && entry.url.length > 0

  return {
    sources: Array.isArray(result?.sources) ? result.sources.filter(usable) : [],
    subtitles: Array.isArray(result?.subtitles) ? result.subtitles.filter(usable) : [],
    diagnostics: Array.isArray(result?.diagnostics) ? result.diagnostics : [],
    expiresAt: result?.expiresAt,
  }
}

/**
 * Provider registry — discovers, registers, and executes providers.
 *
 * Design: Auto-discovery scans the providers/ directory for subdirectories
 * containing an index.ts that exports a class extending BaseProvider.
 * This eliminates manual registration — just drop in a new provider folder.
 */
export class ProviderRegistry {
  private providers = new Map<string, BaseProvider>()

  /** Auto-discover providers from the providers directory */
  async discover(): Promise<void> {
    const providersDir = join(import.meta.dirname)
    const entries = await readdir(providersDir, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (entry.name === 'base' || entry.name === 'registry') continue

      try {
        const mod = await import(`./${entry.name}/index.js`)
        const ProviderClass = mod.default || mod[Object.keys(mod).find(k => k.endsWith('Provider')) || '']

        if (ProviderClass && ProviderClass.prototype?.getMovieSources) {
          const provider = new ProviderClass() as BaseProvider
          if (provider.config.enabled) {
            this.providers.set(provider.config.id, provider)
            console.log(`[Registry] Discovered: ${provider.config.name} (${provider.config.id})`)
          }
        }
      } catch (err) {
        console.warn(`[Registry] Failed to load provider "${entry.name}":`, err)
      }
    }

    console.log(`[Registry] ${this.providers.size} providers active`)
  }

  /** Manually register a provider (Worker path). Respects `enabled` like discover(). */
  register(provider: BaseProvider): void {
    if (!provider.config.enabled) return
    this.providers.set(provider.config.id, provider)
  }

  /** Get a specific provider */
  get(id: string): BaseProvider | undefined {
    return this.providers.get(id)
  }

  /** Get all registered providers */
  getAll(): BaseProvider[] {
    return Array.from(this.providers.values())
  }

  /** Fetch sources from all providers in parallel */
  async resolveSources(
    media: ProviderMediaObject,
    publicUrl: string,
  ): Promise<SourceResponse> {
    const startTime = Date.now()
    // Every provider is resolved in full isolation: it gets its own timeout and
    // its own catch, so a provider that hangs, throws, or returns garbage costs
    // only its own sources. The others still return normally.
    const results = await Promise.allSettled(
      this.getAll().map(async (provider) => {
        const start = Date.now()

        // Stamp provenance onto everything a provider returns. Diagnostics get
        // it too: the merged response otherwise shows bare strings like
        // "API returned 500" with no way to tell which scraper is broken.
        const tag = (result: ProviderResult): ProviderResult => {
          result.sources.forEach(s => {
            s.provider = { id: provider.config.id, name: provider.config.name }
          })
          result.subtitles.forEach(sub => {
            sub.providerId = provider.config.id
          })
          result.diagnostics.forEach(d => {
            d.message = `${provider.config.name}: ${d.message}`
          })
          return result
        }

        try {
          const raw = await withTimeout(
            media.type === 'movie'
              ? provider.getMovieSources(media)
              : provider.getTVSources(media),
            PROVIDER_TIMEOUT_MS,
            provider.config.name,
          )
          return { provider, result: tag(normalizeResult(raw)), elapsed: Date.now() - start }
        } catch (err: any) {
          const message = err?.message ?? 'Unknown error'
          console.warn(`[Registry] ${provider.config.name} failed: ${message}`)
          return {
            provider,
            result: tag(normalizeResult({
              sources: [],
              subtitles: [],
              diagnostics: [{
                code: 'PROVIDER_ERROR' as const,
                message,
                field: '',
                severity: 'error' as const,
              }],
            })),
            elapsed: Date.now() - start,
          }
        }
      }),
    )

    const sources: Source[] = []
    const subtitles: Subtitle[] = []
    const diagnostics: Diagnostic[] = []
    const expiries: number[] = []

    for (const r of results) {
      if (r.status === 'fulfilled') {
        sources.push(...r.value.result.sources)
        subtitles.push(...r.value.result.subtitles)
        diagnostics.push(...r.value.result.diagnostics)
        if (r.value.result.expiresAt) {
          const expiry = Date.parse(r.value.result.expiresAt)
          if (!Number.isNaN(expiry)) expiries.push(expiry)
        }
      } else {
        diagnostics.push({
          code: 'PROVIDER_ERROR' as const,
          message: r.reason?.message || 'Unknown error',
          field: '',
          severity: 'error' as const,
        })
      }
    }

    // Add partial scrape diagnostic if not all providers succeeded. Failures
    // now resolve (tagged with a diagnostic) rather than reject, so settle
    // status no longer distinguishes them — count providers that actually
    // returned something playable instead.
    const succeeded = results.filter(
      r => r.status === 'fulfilled' && r.value.result.sources.length > 0,
    ).length
    const total = results.length
    if (succeeded < total) {
      diagnostics.push({
        code: 'PARTIAL_SCRAPE' as const,
        message: `Only ${succeeded} of ${total} providers returned results`,
        field: '',
        severity: 'warning' as const,
      })
    }

    const expiresAt = expiries.length > 0
      ? Math.min(...expiries)
      : Date.now() + 5 * 60_000
    return {
      responseId: crypto.randomUUID(),
      expiresAt: new Date(expiresAt).toISOString(),
      sources,
      subtitles,
      diagnostics,
    }
  }

  /** Health check all providers */
  async healthCheckAll(): Promise<ProviderHealth[]> {
    const checks = await Promise.allSettled(
      this.getAll().map(async (p) => {
        const start = Date.now()
        const healthy = await p.healthCheck()
        return {
          id: p.config.id,
          name: p.config.name,
          healthy,
          latencyMs: Date.now() - start,
        }
      }),
    )

    return checks
      .filter((r): r is PromiseFulfilledResult<ProviderHealth> => r.status === 'fulfilled')
      .map(r => r.value)
  }
}
