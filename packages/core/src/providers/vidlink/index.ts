import { BaseProvider } from '../base.js'
import { getTokenMinter } from './wasm.js'
import type {
  ProviderConfig,
  ProviderMediaObject,
  ProviderResult,
  Source,
  SourceType,
  Subtitle,
  SubtitleFormat,
} from '@spiflix/shared'

/**
 * VidLink provider — resolves direct, ad-free streams.
 *
 * Flow:
 * 1. Mint a signed token for the TMDB id via the vendored WASM module.
 * 2. GET /api/b/{movie|tv}/{token} → JSON describing the stream.
 * 3. Emit one source per quality (or a single HLS playlist, depending on the
 *    delivery type), each wrapped through our proxy with the upstream's
 *    required Referer/Origin — the CDN rejects requests without them.
 */

interface VidLinkQuality {
  type?: string
  url?: string
  headers?: Record<string, string>
  requiresProxy?: boolean
}

interface VidLinkCaption {
  url?: string
  language?: string
  label?: string
  type?: string
}

interface VidLinkResponse {
  stream?: {
    playlist?: string
    qualities?: Record<string, VidLinkQuality>
    captions?: VidLinkCaption[]
    TTL?: number
    deliveryType?: string
  }
}

export default class VidLinkProvider extends BaseProvider {
  readonly config: ProviderConfig = {
    id: 'vidlink',
    name: 'VidLink',
    enabled: true,
    baseUrl: 'https://vidlink.pro',
    capabilities: { movies: true, tv: true, subtitles: true },
  }

  private headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'https://vidlink.pro/',
    'Origin': 'https://vidlink.pro',
  }

  async getMovieSources(media: ProviderMediaObject): Promise<ProviderResult> {
    return this.getSources(media)
  }

  async getTVSources(media: ProviderMediaObject): Promise<ProviderResult> {
    return this.getSources(media)
  }

  private async getSources(media: ProviderMediaObject): Promise<ProviderResult> {
    try {
      const getAdv = await getTokenMinter()
      const token = getAdv(String(media.tmdbId))
      if (!token) return this.emptyResult([this.errorDiagnostic('Failed to mint token')])

      const apiUrl = media.type === 'movie'
        ? `${this.config.baseUrl}/api/b/movie/${token}?multiLang=0`
        : `${this.config.baseUrl}/api/b/tv/${token}/${media.season}/${media.episode ?? 1}?multiLang=0`

      const res = await fetch(apiUrl, {
        headers: this.headers,
        signal: AbortSignal.timeout(15_000),
      })
      if (!res.ok) return this.emptyResult([this.errorDiagnostic(`API returned ${res.status}`)])

      const data = await res.json() as VidLinkResponse
      const stream = data?.stream
      if (!stream) return this.emptyResult([this.errorDiagnostic('No stream in response')])

      // TTL is in seconds; fall back to the proxy default when absent.
      const ttlMs = Number(stream.TTL) > 0 ? Number(stream.TTL) * 1000 : 3600_000
      const expiresAt = Date.now() + ttlMs

      const sources: Source[] = []

      // Delivery shape A: a single HLS master playlist.
      if (stream.playlist) {
        sources.push({
          url: this.createProxyUrl(stream.playlist, this.headers, expiresAt),
          type: 'hls',
          quality: 'auto',
          provider: { id: this.config.id, name: this.config.name },
          audioTracks: [],
        })
      }

      // Delivery shape B: discrete files per quality. Each is marked
      // `requiresProxy` and carries its own Referer/Origin (usually a different
      // host than vidlink itself). These must be relayed through our proxy,
      // which injects those headers server-side: `Referer` and `Origin` are
      // forbidden header names, so a browser fetching the CDN directly would
      // send our own origin and be rejected. The stream-level `cors-allowed`
      // flag only means the CDN returns CORS headers — it does not waive the
      // referer check.
      for (const [label, q] of Object.entries(stream.qualities ?? {})) {
        if (!q?.url) continue
        const upstreamHeaders = {
          'User-Agent': this.headers['User-Agent'],
          ...(q.headers?.referer ? { Referer: q.headers.referer } : {}),
          ...(q.headers?.origin ? { Origin: q.headers.origin } : {}),
        }
        sources.push({
          url: this.createProxyUrl(q.url, upstreamHeaders, expiresAt),
          type: this.sourceType(q.url, q.type),
          quality: /^\d+$/.test(label) ? `${label}p` : label,
          provider: { id: this.config.id, name: this.config.name },
          audioTracks: [],
        })
      }

      if (sources.length === 0) {
        return this.emptyResult([this.errorDiagnostic('No playable qualities in response')])
      }

      // Highest quality first; 'auto' (HLS) leads when present.
      sources.sort((a, b) => this.rank(b.quality) - this.rank(a.quality))

      // Captions are static SRT files on a plain CDN path — no signing, no
      // referer check — so the client fetches them directly. Proxying a few KB
      // of text would only add a hop.
      const subtitles: Subtitle[] = []
      for (const c of stream.captions ?? []) {
        if (!c?.url) continue
        subtitles.push({
          url: c.url,
          label: c.label || c.language || 'Unknown',
          format: this.subtitleFormat(c.url, c.type),
        })
      }

      return {
        sources,
        subtitles,
        diagnostics: [],
        expiresAt: new Date(expiresAt).toISOString(),
      }
    } catch (err: any) {
      return this.emptyResult([this.errorDiagnostic(err?.message ?? 'Unknown error')])
    }
  }

  private sourceType(url: string, declared?: string): SourceType {
    const path = url.split('?')[0].toLowerCase()
    if (path.endsWith('.m3u8')) return 'hls'
    if (path.endsWith('.mpd')) return 'mpd'
    if (path.endsWith('.mkv')) return 'mkv'
    if (path.endsWith('.webm')) return 'webm'
    if (declared === 'hls') return 'hls'
    return 'mp4'
  }

  private subtitleFormat(url: string, declared?: string): SubtitleFormat {
    const path = url.split('?')[0].toLowerCase()
    if (path.endsWith('.vtt')) return 'vtt'
    if (path.endsWith('.srt')) return 'srt'
    if (path.endsWith('.ass') || path.endsWith('.ssa')) return 'ass'
    if (declared === 'vtt' || declared === 'srt' || declared === 'ass') return declared
    return 'srt'
  }

  private rank(quality: string): number {
    if (quality === 'auto') return 10_000
    return parseInt(quality, 10) || 0
  }

  /** The API host is the health signal; the CDN hosts are per-title. */
  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(this.config.baseUrl, {
        method: 'HEAD',
        headers: this.headers,
        signal: AbortSignal.timeout(5000),
      })
      return res.status < 500
    } catch {
      return false
    }
  }
}
