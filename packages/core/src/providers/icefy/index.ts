import { BaseProvider } from '../base.js'
import type {
  ProviderConfig,
  ProviderMediaObject,
  ProviderResult,
} from '@spiflix/shared'

/**
 * Icefy provider — ported from CinePro Core (cinepro-org/core), adapted to
 * Spiflix's provider interface. English-only, ad-free: a small JSON API
 * returns a single direct stream URL that we wrap through our proxy. No embed
 * page and no ad iframe.
 *
 * Note: Icefy sits behind Cloudflare and can return 403 until a browser has
 * solved the challenge for the host once. When that happens we surface it as
 * a diagnostic rather than throwing.
 *
 * Flow:
 * 1. GET {BASE_URL}/movie/{tmdbId} (or /tv/{tmdbId}/{s}/{e}) → JSON { stream }.
 * 2. Wrap the stream URL through our proxy as a single English HLS source.
 */
export default class IcefyProvider extends BaseProvider {
  readonly config: ProviderConfig = {
    id: 'icefy',
    name: 'Icefy',
    enabled: true,
    baseUrl: 'https://streams.icefy.top',
    capabilities: { movies: true, tv: true, subtitles: false },
  }

  private headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150 Safari/537.36',
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://streams.icefy.top',
    'Origin': 'https://streams.icefy.top',
  }

  async getMovieSources(media: ProviderMediaObject): Promise<ProviderResult> {
    return this.getSources(media)
  }

  async getTVSources(media: ProviderMediaObject): Promise<ProviderResult> {
    return this.getSources(media)
  }

  private async getSources(media: ProviderMediaObject): Promise<ProviderResult> {
    try {
      const apiUrl = this.buildApiUrl(media)
      if (!apiUrl) return this.emptyResult([this.errorDiagnostic('Unsupported media type')])

      const res = await fetch(apiUrl, {
        headers: this.headers,
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) {
        const hint = res.status === 403 ? ' (blocked by Cloudflare — solve the challenge at the base URL once)' : ''
        return this.emptyResult([this.errorDiagnostic(`API returned ${res.status}${hint}`)])
      }

      const data = await res.json() as { stream?: string }
      if (!data?.stream) return this.emptyResult([this.errorDiagnostic('No stream URL returned')])

      return {
        sources: [
          {
            url: this.createProxyUrl(data.stream, this.headers),
            type: 'hls',
            // Nominal, not probed — display-formatted like other providers.
            quality: '1080p',
            audioTracks: [{ language: 'eng', label: 'English' }],
            provider: { id: this.config.id, name: this.config.name },
          },
        ],
        subtitles: [],
        diagnostics: [],
      }
    } catch (err: any) {
      return this.emptyResult([this.errorDiagnostic(err.message)])
    }
  }

  private buildApiUrl(media: ProviderMediaObject): string | null {
    if (media.type === 'movie') {
      return `${this.config.baseUrl}/movie/${media.tmdbId}`
    }
    if (media.type === 'tv') {
      return `${this.config.baseUrl}/tv/${media.tmdbId}/${media.season}/${media.episode}`
    }
    return null
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(this.config.baseUrl, {
        method: 'HEAD',
        headers: this.headers,
        signal: AbortSignal.timeout(5000),
      })
      return res.status === 200
    } catch {
      return false
    }
  }
}
