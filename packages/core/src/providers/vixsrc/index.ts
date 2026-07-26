import { BaseProvider } from '../base.js'
import type {
  ProviderConfig,
  ProviderMediaObject,
  ProviderResult,
  Source,
  Subtitle,
} from '@spiflix/shared'

/**
 * VixSrc provider — multi-step scraping flow.
 *
 * Flow:
 * 1. GET /api/movie/{tmdbId} → JSON with embed URL
 * 2. GET {embed_url} → HTML containing token, expires, playlist URLs
 * 3. Build stream URLs: {playlist}?token={token}&expires={expires}&h=1
 * 4. Try all available stream servers, collect working playlists
 * 5. Wrap each through proxy
 */
export default class VixSrcProvider extends BaseProvider {
  readonly config: ProviderConfig = {
    id: 'vixsrc',
    name: 'VixSrc',
    enabled: true,
    baseUrl: 'https://vixsrc.to',
    capabilities: { movies: true, tv: true, subtitles: false },
  }

  private headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150 Safari/537.36',
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://vixsrc.to',
    'Origin': 'https://vixsrc.to',
  }

  async getMovieSources(media: ProviderMediaObject): Promise<ProviderResult> {
    return this.getSources(media)
  }

  async getTVSources(media: ProviderMediaObject): Promise<ProviderResult> {
    return this.getSources(media)
  }

  private async getSources(media: ProviderMediaObject): Promise<ProviderResult> {
    try {
      // Step 1: Get embed URL from API
      const apiUrl = media.type === 'movie'
        ? `${this.config.baseUrl}/api/movie/${media.tmdbId}`
        : `${this.config.baseUrl}/api/tv/${media.tmdbId}/${media.season}/${media.episode}`

      const apiRes = await fetch(apiUrl, {
        headers: this.headers,
        signal: AbortSignal.timeout(10_000),
      })
      if (!apiRes.ok) return this.emptyResult([this.errorDiagnostic(`API returned ${apiRes.status}`)])

      const apiData = await apiRes.json() as { src?: string }
      if (!apiData.src) return this.emptyResult([this.errorDiagnostic('No embed URL in API response')])

      // Step 2: Fetch embed page to extract token + all stream URLs
      const embedUrl = `${this.config.baseUrl}${apiData.src}`
      const embedRes = await fetch(embedUrl, {
        headers: this.headers,
        signal: AbortSignal.timeout(10_000),
      })
      if (!embedRes.ok) return this.emptyResult([this.errorDiagnostic(`Embed returned ${embedRes.status}`)])

      const html = await embedRes.text()
      const tokenData = this.extractTokenData(html)
      if (!tokenData) return this.emptyResult([this.errorDiagnostic('Failed to extract token data')])

      // Collect all stream URLs (masterPlaylist + any in window.streams)
      const streamUrls = this.collectStreamUrls(html, tokenData)

      // Step 3: Try all stream URLs in parallel, collect working ones
      const results = await Promise.allSettled(
        streamUrls.map(async ({ url, label }) => {
          const fullUrl = this.buildStreamUrl(url, tokenData)
          const playlistRes = await fetch(fullUrl, {
            headers: { ...this.headers, Referer: embedUrl },
            signal: AbortSignal.timeout(10_000),
          })
          if (!playlistRes.ok) throw new Error(`Playlist returned ${playlistRes.status}`)
          const playlist = await playlistRes.text()
          const variants = this.parseVariants(playlist)
          const bestResolution = variants.length > 0
            ? Math.max(...variants.map(v => v.resolution))
            : 1080

          return {
            url: this.createProxyUrl(fullUrl, {
              ...this.headers,
              Referer: embedUrl,
            }, new Date(Number(tokenData.expires) * 1000).getTime()),
            type: 'hls' as const,
            quality: `${bestResolution}p`,
            provider: { id: this.config.id, name: this.config.name },
            audioTracks: this.parseAudioTracks(playlist),
            label,
            playlist,
          }
        }),
      )

      const sources: Source[] = []
      const subtitles: Subtitle[] = []
      let bestPlaylist = ''

      for (const r of results) {
        if (r.status === 'fulfilled') {
          const { playlist, label: _label, ...source } = r.value
          sources.push(source)
          if (!bestPlaylist) bestPlaylist = playlist
          // Merge subtitles from first successful playlist
          if (subtitles.length === 0) {
            subtitles.push(...this.parseSubtitles(playlist))
          }
        }
      }

      if (sources.length === 0) return this.emptyResult([this.errorDiagnostic('All playlist servers failed')])

      return {
        sources,
        subtitles,
        diagnostics: [],
        expiresAt: new Date(Number(tokenData.expires) * 1000).toISOString(),
      }
    } catch (err: any) {
      return this.emptyResult([this.errorDiagnostic(err.message)])
    }
  }

  private extractTokenData(html: string): { token: string; expires: string; playlist: string } | null {
    // Extract from window.masterPlaylist
    const match = html.match(/window\.masterPlaylist\s*=\s*\{([^}]+)\}/)
    if (!match) return null
    const block = match[1]
    const token = block.match(/token['"]\s*:\s*['"]([^'"]+)/)?.[1]
    const expires = block.match(/expires['"]\s*:\s*['"]([^'"]+)/)?.[1]
    const playlistMatch = block.match(/url\s*:\s*['"]([^'"]+)/)
    const playlist = playlistMatch ? playlistMatch[1] : html.match(/url\s*:\s*['"]([^'"]+)/)?.[1]

    if (!token || !expires || !playlist) return null

    const expiresMs = Number(expires) * 1000
    if (!Number.isFinite(expiresMs) || expiresMs - 60_000 < Date.now()) return null

    return { token, expires, playlist }
  }

  private collectStreamUrls(html: string, tokenData: { token: string; expires: string; playlist: string }): Array<{ url: string; label: string }> {
    const urls: Array<{ url: string; label: string }> = []

    // Always include the primary master playlist
    urls.push({ url: tokenData.playlist, label: 'Auto' })

    // Extract window.streams for alternate CDN servers
    const streamsMatch = html.match(/window\.streams\s*=\s*(\[[^\]]+\])/)
    if (streamsMatch) {
      try {
        const decoded = streamsMatch[1].replace(/\\u0026/g, '&')
        const streams = JSON.parse(decoded) as Array<{ name: string; active: boolean; url: string }>
        for (const s of streams) {
          urls.push({ url: s.url, label: s.name })
        }
      } catch {
        // window.streams parsing is non-critical
      }
    }

    return urls
  }

  private buildStreamUrl(baseUrl: string, data: { token: string; expires: string }): string {
    const separator = baseUrl.includes('?') ? '&' : '?'
    return `${baseUrl}${separator}token=${data.token}&expires=${data.expires}&h=1`
  }

  private parseVariants(content: string): Array<{ resolution: number; url: string }> {
    const variants: Array<{ resolution: number; url: string }> = []
    const regex = /#EXT-X-STREAM-INF:[^\n]*RESOLUTION=\d+x(\d+)[^\n]*\n([^\n]+)/g
    let match
    while ((match = regex.exec(content)) !== null) {
      variants.push({ resolution: parseInt(match[1], 10), url: match[2] })
    }
    return variants
  }

  private parseAudioTracks(content: string): Array<{ language: string; label: string }> {
    const tracks: Array<{ language: string; label: string }> = []
    for (const line of content.split('\n')) {
      if (!line.startsWith('#EXT-X-MEDIA:') || !/TYPE=AUDIO\b/.test(line)) continue
      const language = line.match(/LANGUAGE="([^"]+)"/)?.[1] ?? 'unknown'
      const label = line.match(/NAME="([^"]+)"/)?.[1] ?? 'Audio'
      tracks.push({ language, label })
    }
    return tracks
  }

  private parseSubtitles(content: string): Subtitle[] {
    const subtitles: Subtitle[] = []
    for (const line of content.split('\n')) {
      if (!line.startsWith('#EXT-X-MEDIA:') || !/TYPE=SUBTITLES\b/.test(line)) continue
      const url = line.match(/URI="([^"]+)"/)?.[1]
      if (!url) continue
      const language = line.match(/NAME="([^"]+)"/)?.[1] ?? 'unknown'
      subtitles.push({
        url: this.createProxyUrl(url, this.headers),
        label: language,
        format: 'vtt',
      })
    }
    return subtitles
  }
}
