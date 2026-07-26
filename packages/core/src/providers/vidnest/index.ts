import { BaseProvider } from '../base.js'
import type {
  ProviderConfig,
  ProviderMediaObject,
  ProviderResult,
  Source,
  Subtitle,
  SourceType,
  SubtitleFormat,
  Diagnostic,
} from '@spiflix/shared'
import decrypt from './decrypt.js'

/**
 * Several VidNest upstreams (moviebox vault, vidlink's re-signed copies) sign
 * URLs with a unix-seconds `t=` expiry. VidNest serves them from a stale cache,
 * so links can arrive hours past expiry and 429 immediately. A 60s grace keeps
 * links that would expire mid-request from slipping through.
 */
function isExpiredSignedUrl(url: string): boolean {
  const t = url.match(/[?&]t=(\d{9,11})(?:$|&)/)?.[1]
  if (!t) return false
  return Number(t) < Date.now() / 1000 + 60
}
import type {
  ServerMap,
  SupportedServer,
  KlikxxiResponse,
  AllmoviesResponse,
  OnehdResponse,
  HollymoviehdResponse,
  VidlinkResponse,
  DeltaResponse,
  PurstreamResponse,
  MovieboxSource,
} from './types.js'

/**
 * VidNest provider — ported from CinePro Core (cinepro-org/core), adapted to
 * Spiflix's provider interface. English-primary aggregator: it fans out to
 * several upstream servers in parallel and returns their direct stream URLs,
 * each wrapped through our proxy (no embed pages / ad iframes). A few upstreams
 * carry non-English dubs (purstream = French, moviebox/delta = mixed); those
 * are tagged with their real language so the player's language-aware source
 * picker never prefers them over an English track.
 */
export default class VidNestProvider extends BaseProvider {
  readonly config: ProviderConfig = {
    id: 'vidnest',
    name: 'VidNest',
    enabled: true,
    baseUrl: 'https://vidnest.fun',
    capabilities: { movies: true, tv: true, subtitles: true },
  }

  private readonly apiBaseUrl = 'https://new.vidnest.fun'

  private headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150 Safari/537.36',
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://vidnest.fun/',
    'Origin': 'https://vidnest.fun',
  }

  /** Upstream servers to query. Entries without a handler below are skipped. */
  private readonly servers: { path: string; query: string }[] = [
    { path: 'moviebox', query: '' },
    { path: 'allmovies', query: '' },
    { path: 'purstream', query: '' },
    { path: 'hollymoviehd', query: '' },
    { path: 'vidlink', query: '' },
    { path: 'onehd', query: '?server=upcloud' },
    // klikxxi disabled 2026-07: its CDN (halcyoncreative.site) 403s every
    // server-side request — plain 403 with any Referer/Origin combo, Cloudflare
    // challenge without one. Needs browser-session state we can't provide, so
    // it only ever produced a dead source that padded the failover chain.
    // Handler + types kept below for easy re-enable if their edge changes.
    // { path: 'klikxxi', query: '' },
  ]

  private readonly handlers: {
    [K in SupportedServer]: {
      parse: (data: string) => ServerMap[K]
      mapSources: (root: ServerMap[K]) => Source[]
      mapSubtitles: (root: ServerMap[K]) => Subtitle[]
    }
  } = {
    klikxxi: {
      parse: (d) => decrypt<KlikxxiResponse>(d),
      mapSources: (root) =>
        root.sources.map((s) => ({
          url: this.createProxyUrl(s.url),
          type: this.inferSourceType(s.type, s.url),
          quality: s.quality,
          audioTracks: [{ language: 'eng', label: 'English' }],
          provider: { id: this.config.id, name: this.config.name },
        })),
      mapSubtitles: () => [],
    },

    allmovies: {
      parse: (d) => decrypt<AllmoviesResponse>(d),
      mapSources: (root) =>
        root.streams.map((s) => ({
          url: this.createProxyUrl(s.url, s.headers),
          type: this.inferSourceType(s.type, s.url),
          quality: 'Auto',
          audioTracks: [{ language: s.language, label: s.language }],
          provider: { id: this.config.id, name: this.config.name },
        })),
      mapSubtitles: () => [],
    },

    onehd: {
      parse: (d) => decrypt<OnehdResponse>(d),
      mapSources: (root) => [
        {
          url: this.createProxyUrl(root.url, root.headers),
          type: this.inferSourceType('', root.url),
          quality: 'Auto',
          audioTracks: [{ language: 'eng', label: 'English' }],
          provider: { id: this.config.id, name: this.config.name },
        },
      ],
      mapSubtitles: (root) =>
        root.subtitles.map((s) => ({
          url: this.createProxyUrl(s.url, root.headers),
          label: s.lang,
          format: this.inferSubtitleFormat(s.url),
        })),
    },

    hollymoviehd: {
      parse: (d) => decrypt<HollymoviehdResponse>(d),
      // Only the MAIN stream: it's the primary (English) file and fetches
      // cleanly, while the LS/GS goodstream.cc mirrors sit behind a Cloudflare
      // challenge and 403 from a server — mapping them just slows failover.
      mapSources: (root) =>
        (root.streams ?? [])
          .filter((s) => s.language === 'MAIN')
          .map((s) => ({
            url: this.createProxyUrl(s.url),
            type: this.inferSourceType(s.type, s.url),
            quality: 'Auto',
            audioTracks: [{ language: 'eng', label: 'English' }],
            provider: { id: this.config.id, name: this.config.name },
          })),
      mapSubtitles: () => [],
    },

    vidlink: {
      parse: (d) => decrypt<VidlinkResponse>(d),
      mapSources: (root) => {
        const stream = root.data.stream
        // Current shape: per-quality signed mp4s (moviebox vault). Skip links
        // whose `t=` signature is already expired — they 429 on arrival.
        if (stream.qualities) {
          return Object.entries(stream.qualities)
            .filter(([, q]) => q?.url && !isExpiredSignedUrl(q.url))
            .map(([label, q]) => ({
              url: this.createProxyUrl(q.url, q.headers ?? root.headers),
              type: this.inferSourceType(q.type, q.url),
              quality: /^\d+$/.test(label) ? `${label}p` : label,
              audioTracks: [{ language: 'eng', label: 'English' }],
              provider: { id: this.config.id, name: this.config.name },
            }))
        }
        // Legacy HLS shape.
        if (stream.playlist) {
          return [{
            url: this.createProxyUrl(stream.playlist, root.headers),
            type: this.inferSourceType(stream.type ?? '', stream.playlist),
            quality: 'Auto',
            audioTracks: [{ language: 'eng', label: 'English' }],
            provider: { id: this.config.id, name: this.config.name },
          }]
        }
        return []
      },
      mapSubtitles: (root) =>
        (root.data.stream.captions ?? [])
          .filter((c) => !isExpiredSignedUrl(c.url))
          .map((c) => ({
            url: this.createProxyUrl(c.url, root.headers),
            label: c.language,
            format: this.inferSubtitleFormat(c.url),
          })),
    },

    delta: {
      parse: (d) => decrypt<DeltaResponse>(d),
      mapSources: (root) =>
        root.streams.map((s) => ({
          url: this.createProxyUrl(s.url, s.headers),
          type: this.inferSourceType(s.type, s.url),
          quality: 'Auto',
          audioTracks: [{ language: s.language.slice(0, 3).toLowerCase(), label: s.language }],
          provider: { id: this.config.id, name: this.config.name },
        })),
      mapSubtitles: () => [],
    },

    purstream: {
      parse: (d) => decrypt<PurstreamResponse>(d),
      mapSources: (root) =>
        root.sources.map((s) => ({
          url: this.createProxyUrl(s.url),
          type: this.inferSourceType(s.format, s.url),
          quality: 'Auto',
          audioTracks: [{ language: 'fre', label: 'French' }],
          provider: { id: this.config.id, name: this.config.name },
        })),
      mapSubtitles: () => [],
    },

    moviebox: {
      parse: (d) => decrypt<MovieboxSource>(d),
      // VidNest caches these hakunaymatata links well past their signed `t=`
      // expiry (observed ~22h stale), so they 429 the moment we get them.
      // Filtering the expired ones keeps the working case and stops dead mp4s
      // from padding the player's failover chain.
      mapSources: (root) =>
        root.url
          .filter((u) => !isExpiredSignedUrl(u.link))
          .map((u) => ({
            url: this.createProxyUrl(u.link, this.headers),
            type: this.inferSourceType(u.type, u.link),
            quality: u.resolution || 'Auto',
            audioTracks: [{ language: u.lang.slice(0, 3).toLowerCase(), label: u.lang }],
            provider: { id: this.config.id, name: this.config.name },
          })),
      mapSubtitles: () => [],
    },
  }

  async getMovieSources(media: ProviderMediaObject): Promise<ProviderResult> {
    return this.getSources(media)
  }

  async getTVSources(media: ProviderMediaObject): Promise<ProviderResult> {
    return this.getSources(media)
  }

  private async getSources(media: ProviderMediaObject): Promise<ProviderResult> {
    const sources: Source[] = []
    const subtitles: Subtitle[] = []
    const diagnostics: Diagnostic[] = []

    const results = await Promise.allSettled(
      this.servers.map((server) => this.fetchVidnest(this.buildUrl(media, server.path) + server.query)),
    )

    if (results.every((r) => r.status === 'rejected')) {
      return this.emptyResult([this.errorDiagnostic('No upstream server returned the requested media')])
    }

    results.forEach((result, i) => {
      if (result.status !== 'fulfilled') return
      const key = this.servers[i].path as SupportedServer
      if (!(key in this.handlers)) return

      try {
        const parsed = this.runHandler(key, result.value.data)
        sources.push(...parsed.sources)
        subtitles.push(...parsed.subtitles)
      } catch (err: any) {
        diagnostics.push(this.partialDiagnostic(`${key}: ${err.message}`))
      }
    })

    return { sources, subtitles, diagnostics }
  }

  /**
   * Parse + map a single server's payload. The generic keeps the `key` tied to
   * its response type so `mapSources` receives the exact shape `parse` produced.
   */
  private runHandler<K extends SupportedServer>(key: K, data: string): { sources: Source[]; subtitles: Subtitle[] } {
    const handler = this.handlers[key]
    const root = handler.parse(data)
    return { sources: handler.mapSources(root), subtitles: handler.mapSubtitles(root) }
  }

  private buildUrl(media: ProviderMediaObject, server: string): string {
    return media.type === 'movie'
      ? `${this.apiBaseUrl}/${server}/movie/${media.tmdbId}`
      : `${this.apiBaseUrl}/${server}/tv/${media.tmdbId}/${media.season}/${media.episode}`
  }

  private async fetchVidnest(url: string): Promise<{ encrypted: boolean; data: string }> {
    const res = await fetch(url, {
      headers: this.headers,
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`VidNest: ${res.status}`)
    return res.json() as Promise<{ encrypted: boolean; data: string }>
  }

  private inferSourceType(type: string, url: string): SourceType {
    const t = (type ?? '').toLowerCase()
    if (t === 'hls' || url.includes('.m3u8')) return 'hls'
    if (t === 'dash' || url.includes('.mpd')) return 'mpd'
    if (t === 'mp4' || url.includes('.mp4')) return 'mp4'
    if (t === 'mkv' || url.includes('.mkv')) return 'mkv'
    if (t === 'webm' || url.includes('.webm')) return 'webm'
    return 'hls'
  }

  private inferSubtitleFormat(url: string): SubtitleFormat {
    const u = url.toLowerCase()
    if (u.includes('.srt')) return 'srt'
    if (u.includes('.ass') || u.includes('.ssa')) return 'ass'
    return 'vtt'
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
