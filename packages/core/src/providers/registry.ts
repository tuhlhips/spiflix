import type { IProvider, ProviderHealth, ProviderMediaObject, SourceResponse, Source, Subtitle, Diagnostic } from '@spiflix/shared'
import type { BaseProvider } from './base.js'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

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

  /** Manually register a provider */
  register(provider: BaseProvider): void {
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
    const results = await Promise.allSettled(
      this.getAll().map(async (provider) => {
        const start = Date.now()
        const result = media.type === 'movie'
          ? await provider.getMovieSources(media)
          : await provider.getTVSources(media)
        const elapsed = Date.now() - start

        // Tag each source with provider info
        result.sources.forEach(s => {
          s.provider = { id: provider.config.id, name: provider.config.name }
        })

        return { provider, result, elapsed }
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

    // Add partial scrape diagnostic if not all providers succeeded
    const succeeded = results.filter(r => r.status === 'fulfilled').length
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
