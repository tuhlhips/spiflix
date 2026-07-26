import { BaseProvider } from '../base.js'
import type {
  ProviderConfig,
  ProviderMediaObject,
  ProviderResult,
  Source,
} from '@spiflix/shared'

/**
 * VidSrc provider — ported from CinePro Core (cinepro-org/core), adapted to
 * Spiflix's provider interface. English-primary source, used to fill gaps
 * where VixSrc only carries a single (often Italian) dub for a title.
 *
 * Flow:
 * 1. GET {BASE_URL}/embed/movie?tmdb={id} (or /embed/tv?... for TV) → HTML
 *    containing an <iframe src="..."> to a second player page.
 * 2. GET that iframe URL → HTML containing an inline `src: '...'` pointing
 *    to a third page.
 * 3. GET that third URL → HTML containing a `file: '...'` field with one or
 *    more m3u8 URLs (using {v1}/{v2}/{v3}/{v4} domain placeholders).
 * 4. Wrap each resolved m3u8 URL through our proxy.
 */
export default class VidSrcProvider extends BaseProvider {
  readonly config: ProviderConfig = {
    id: 'vidsrc',
    name: 'VidSrc',
    enabled: true,
    baseUrl: 'https://vsembed.ru',
    capabilities: { movies: true, tv: true, subtitles: false },
  }

  private headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150 Safari/537.36',
    'Referer': 'https://vsembed.ru',
  }

  async getMovieSources(media: ProviderMediaObject): Promise<ProviderResult> {
    return this.getSources(media)
  }

  async getTVSources(media: ProviderMediaObject): Promise<ProviderResult> {
    return this.getSources(media)
  }

  private async getSources(media: ProviderMediaObject): Promise<ProviderResult> {
    try {
      const pageUrl = this.buildPageUrl(media)

      const html = await this.fetchPage(pageUrl)
      if (!html) return this.emptyResult([this.errorDiagnostic('Failed to fetch page')])

      const secondUrl = this.extractSecondUrl(html)
      if (!secondUrl) return this.emptyResult([this.errorDiagnostic('Invalid or expired token')])

      const secondHtml = await this.fetchPage(secondUrl)
      if (!secondHtml) return this.emptyResult([this.errorDiagnostic('Failed to fetch stream page')])

      const thirdUrl = this.extractThirdUrl(secondHtml, secondUrl)
      if (!thirdUrl) return this.emptyResult([this.errorDiagnostic('Failed to extract stream URL')])

      const thirdHtml = await this.fetchPage(thirdUrl)
      if (!thirdHtml) return this.emptyResult([this.errorDiagnostic('Failed to fetch final stream page')])

      const m3u8Urls = this.extractM3u8Urls(thirdHtml)
      if (!m3u8Urls || m3u8Urls.length === 0) {
        return this.emptyResult([this.errorDiagnostic('Failed to extract m3u8 URLs')])
      }

      const sources: Source[] = m3u8Urls.map(url => ({
        url: this.createProxyUrl(url, {
          ...this.headers,
          Referer: 'https://cloudnestra.com/',
          Origin: 'https://cloudnestra.com',
        }),
        type: 'hls',
        quality: 'Auto',
        audioTracks: [{ label: 'English', language: 'eng' }],
        provider: { id: this.config.id, name: this.config.name },
      }))

      return { sources, subtitles: [], diagnostics: [] }
    } catch (err: any) {
      return this.emptyResult([this.errorDiagnostic(err.message)])
    }
  }

  private buildPageUrl(media: ProviderMediaObject): string {
    if (media.type === 'movie') {
      return `${this.config.baseUrl}/embed/movie?tmdb=${media.tmdbId}`
    }
    return `${this.config.baseUrl}/embed/tv?tmdb=${media.tmdbId}&season=${media.season}&episode=${media.episode}`
  }

  private async fetchPage(url: string): Promise<string | null> {
    try {
      const fullUrl = url.startsWith('//') ? `https:${url}` : url
      const res = await fetch(fullUrl, {
        headers: this.headers,
        signal: AbortSignal.timeout(10_000),
      })
      if (res.status !== 200) return null
      return await res.text()
    } catch {
      return null
    }
  }

  /** Extract the second-stage iframe URL from the embed page */
  private extractSecondUrl(html: string): string | null {
    return html.match(/<iframe[^>]*\s+src=["']([^"']+)["'][^>]*>/i)?.[1] ?? null
  }

  /** Extract the third-stage URL from inline JS (loadIframe), resolved against the second URL's domain */
  private extractThirdUrl(html: string, secondUrl: string): string | null {
    const relSrc = html.match(/src:\s*['"]([^'"]+)['"]/i)?.[1]
    if (!relSrc) return null

    const base = secondUrl.startsWith('//') ? `https:${secondUrl}` : secondUrl
    try {
      return new URL(relSrc, base).href
    } catch {
      return null
    }
  }

  /** Extract m3u8 URL(s) from the `file:` field, resolving {v1}..{v4} domain placeholders */
  private extractM3u8Urls(html: string): string[] | null {
    const fileField = html.match(/file\s*:\s*["']([^"']+)["']/i)?.[1]
    if (!fileField) return null

    const playerDomains = new Map<string, string>([
      ['{v1}', 'neonhorizonworkshops.com'],
      ['{v2}', 'wanderlynest.com'],
      ['{v3}', 'orchidpixelgardens.com'],
      ['{v4}', 'cloudnestra.com'],
    ])

    const urls = fileField
      .split(/\s+or\s+/i)
      .map(template => {
        let url = template
        for (const [placeholder, domain] of playerDomains) {
          url = url.replace(placeholder, domain)
        }
        return url.includes('{') || url.includes('}') ? null : url
      })
      .filter((url): url is string => url !== null)

    return urls.length > 0 ? urls : null
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
