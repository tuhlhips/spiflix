import { BaseProvider } from '../base.js'
import type {
  ProviderConfig,
  ProviderMediaObject,
  ProviderResult,
} from '@spiflix/shared'

/**
 * CineSu provider — ported from CinePro Core (cinepro-org/core), adapted to
 * Spiflix's provider interface. English-primary and one of the cleanest
 * sources available: it exposes a direct master m3u8 keyed by TMDB id, so
 * there is no embed page, no ad iframe, and no token dance — we just verify
 * the manifest exists and wrap it through our proxy.
 *
 * Flow:
 * 1. Build the master playlist URL from the TMDB id.
 * 2. HEAD it to confirm the title is available.
 * 3. Wrap the m3u8 through our proxy as a single English HLS source.
 */
export default class CineSuProvider extends BaseProvider {
  readonly config: ProviderConfig = {
    id: 'cinesu',
    name: 'CineSu',
    // Disabled: the master-playlist HEAD check fails for every title from our
    // hosts (cine.su appears geo/Cloudflare gated). Flip back to true if it
    // starts resolving — the scraping logic itself is correct.
    enabled: false,
    baseUrl: 'https://cine.su',
    capabilities: { movies: true, tv: true, subtitles: false },
  }

  private headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150 Safari/537.36',
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://cine.su/en/watch',
    'Origin': 'https://cine.su',
  }

  async getMovieSources(media: ProviderMediaObject): Promise<ProviderResult> {
    return this.getSources(media)
  }

  async getTVSources(media: ProviderMediaObject): Promise<ProviderResult> {
    return this.getSources(media)
  }

  private async getSources(media: ProviderMediaObject): Promise<ProviderResult> {
    try {
      const streamUrl = this.buildManifestUrl(media)
      if (!streamUrl) return this.emptyResult([this.errorDiagnostic('Unsupported media type')])

      const reachable = await this.testUrl(streamUrl)
      if (!reachable) return this.emptyResult([this.errorDiagnostic('Stream URL is not accessible')])

      return {
        sources: [
          {
            url: this.createProxyUrl(streamUrl, this.headers),
            type: 'hls',
            quality: '1080',
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

  private buildManifestUrl(media: ProviderMediaObject): string | null {
    if (media.type === 'movie') {
      return `${this.config.baseUrl}/v1/stream/master/movie/${media.tmdbId}.m3u8`
    }
    if (media.type === 'tv') {
      return `${this.config.baseUrl}/v1/stream/master/tv/${media.tmdbId}/${media.season}/${media.episode}.m3u8`
    }
    return null
  }

  private async testUrl(url: string): Promise<boolean> {
    try {
      const res = await fetch(url, {
        method: 'HEAD',
        headers: this.headers,
        signal: AbortSignal.timeout(10_000),
      })
      return res.status === 200
    } catch {
      return false
    }
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
