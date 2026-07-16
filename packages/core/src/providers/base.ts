import type {
  IProvider,
  ProviderConfig,
  ProviderCapabilities,
  ProviderMediaObject,
  ProviderResult,
} from '@spiflix/shared'
import { createProxyUrl } from '../services/proxy.js'

/**
 * Base provider class. All scrapers extend this.
 *
 * Design: Providers are pure scrapers — they fetch source URLs from
 * third-party sites and return them wrapped in a standard result type.
 * They never serve content directly; that's the proxy's job.
 *
 * Key pattern: every URL returned by a provider must go through
 * `createProxyUrl()` so the backend can proxy streaming traffic
 * with proper CORS and headers.
 */
export abstract class BaseProvider implements IProvider {
  abstract readonly config: ProviderConfig

  abstract getMovieSources(media: ProviderMediaObject): Promise<ProviderResult>
  abstract getTVSources(media: ProviderMediaObject): Promise<ProviderResult>

  /** HEAD request to baseUrl — returns true if < 500 */
  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(this.config.baseUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
      })
      return res.status < 500
    } catch {
      return false
    }
  }

  /** Build proxy URL that routes through our own server */
  protected createProxyUrl(url: string, headers: Record<string, string> = {}, expiresAt?: number): string {
    const base = process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`
    return createProxyUrl(url, headers, base, expiresAt)
  }

  /** Convenience: build an empty result with diagnostics */
  protected emptyResult(diagnostics: ProviderResult['diagnostics'] = []): ProviderResult {
    return { sources: [], subtitles: [], diagnostics }
  }

  /** Convenience: wrap an error as a diagnostic */
  protected errorDiagnostic(message: string): ProviderResult['diagnostics'][number] {
    return { code: 'PROVIDER_ERROR', message, field: '', severity: 'error' }
  }

  /** Convenience: wrap a partial failure as a diagnostic */
  protected partialDiagnostic(message: string): ProviderResult['diagnostics'][number] {
    return { code: 'PARTIAL_SCRAPE', message, field: '', severity: 'warning' }
  }
}
