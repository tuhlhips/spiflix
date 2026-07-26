import { BaseProvider } from '../base.js'
import type {
  ProviderConfig,
  ProviderMediaObject,
  ProviderResult,
  Source,
  Subtitle,
} from '@spiflix/shared'
import { encryptItemId } from './encrypt.js'

interface VidrockStreamInfo {
  url: string | null
  language: string | null
  flag: string | null
}
type VidrockStreams = Record<string, VidrockStreamInfo>
interface VidrockCDN {
  resolution: string
  url: string
}

const PROXY_PREFIX = 'https://proxy.vidrock.store/'

/**
 * VidRock provider — ported from CinePro Core (cinepro-org/core), adapted to
 * Spiflix's provider interface. Multi-language source that clearly labels each
 * stream's language; we tag English streams as `eng` and everything else as
 * its real language, so the language-aware source picker only prefers the
 * English ones. All stream URLs are wrapped through our proxy — no embeds.
 */
export default class VidRockProvider extends BaseProvider {
  readonly config: ProviderConfig = {
    id: 'vidrock',
    name: 'VidRock',
    // Disabled: the encrypted api never returns 200 from our hosts (needs the
    // real browser flow / is region-gated). Flip back to true if it starts
    // resolving — the scraping logic itself is correct.
    enabled: false,
    baseUrl: 'https://vidrock.net',
    capabilities: { movies: true, tv: true, subtitles: true },
  }

  private readonly subBaseUrl = 'https://sub.vdrk.site'

  private headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150 Safari/537.36',
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://vidrock.net/',
    'Origin': 'https://vidrock.net',
  }

  async getMovieSources(media: ProviderMediaObject): Promise<ProviderResult> {
    return this.getSources(media)
  }

  async getTVSources(media: ProviderMediaObject): Promise<ProviderResult> {
    return this.getSources(media)
  }

  private async getSources(media: ProviderMediaObject): Promise<ProviderResult> {
    try {
      const pageUrl = await this.buildUrl(media)
      const data = await this.fetchPage(pageUrl)
      if (!data) return this.emptyResult([this.errorDiagnostic('Failed to fetch page')])

      const resp = data as VidrockStreams
      const sources: Source[] = []

      for (const stream of Object.values(resp)) {
        if (!stream?.url) continue
        const language = stream.language === 'English' ? 'eng' : 'unknown'
        const label = stream.language ?? 'Unknown'

        // Some entries point at a second CDN listing that must be fetched and
        // expanded into one source per resolution.
        if (stream.url.includes('hls2.vdrk.site')) {
          const cdnList = (await this.fetchPage(stream.url)) as VidrockCDN[] | null
          if (!cdnList) continue

          for (const obj of cdnList) {
            let finalUrl = obj.url
            if (obj.url.startsWith(PROXY_PREFIX)) {
              finalUrl = decodeURIComponent(obj.url.slice(PROXY_PREFIX.length).replace(/^\//, ''))
            }
            sources.push({
              url: this.createProxyUrl(finalUrl, {
                ...this.headers,
                Referer: 'https://lok-lok.cc/',
                Origin: 'https://lok-lok.cc/',
              }),
              type: obj.url.includes('.mp4') ? 'mp4' : 'hls',
              quality: `${obj.resolution}p`,
              audioTracks: [{ language, label }],
              provider: { id: this.config.id, name: this.config.name },
            })
          }
          continue
        }

        sources.push({
          url: this.createProxyUrl(
            stream.url,
            stream.url.includes('67streams')
              ? { Referer: this.config.baseUrl, Origin: this.config.baseUrl }
              : { ...this.headers, Referer: this.config.baseUrl },
          ),
          type: 'hls',
          quality: '1080',
          audioTracks: [{ language, label }],
          provider: { id: this.config.id, name: this.config.name },
        })
      }

      const subtitles = await this.fetchSubtitles(media)
      return { sources, subtitles, diagnostics: [] }
    } catch (err: any) {
      return this.emptyResult([this.errorDiagnostic(err.message)])
    }
  }

  private async fetchSubtitles(media: ProviderMediaObject): Promise<Subtitle[]> {
    try {
      const subUrl = media.type === 'tv'
        ? `${this.subBaseUrl}/v2/tv/${media.tmdbId}/${media.season}/${media.episode}`
        : `${this.subBaseUrl}/v2/movie/${media.tmdbId}`

      const res = await fetch(subUrl, {
        headers: { ...this.headers, Referer: this.config.baseUrl },
        signal: AbortSignal.timeout(10_000),
      })
      if (res.status !== 200) return []

      const subsData = await res.json() as Array<{ label: string; file: string }>
      return subsData.map((sub) => ({
        url: this.createProxyUrl(sub.file, { ...this.headers, Referer: subUrl }),
        format: 'vtt',
        label: sub.label,
      }))
    } catch {
      return []
    }
  }

  private async buildUrl(media: ProviderMediaObject): Promise<string> {
    const itemId = media.type === 'tv'
      ? `${media.tmdbId}_${media.season}_${media.episode}`
      : `${media.tmdbId}`
    const encrypted = await encryptItemId(itemId)
    return `${this.config.baseUrl}/api/${media.type}/${encrypted}`
  }

  private async fetchPage(url: string): Promise<unknown | null> {
    try {
      const res = await fetch(url, {
        headers: { ...this.headers, Referer: this.config.baseUrl },
        signal: AbortSignal.timeout(10_000),
      })
      if (res.status !== 200) return null
      const contentType = res.headers.get('content-type') ?? ''
      return contentType.includes('application/json') ? await res.json() : await res.text()
    } catch {
      return null
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
