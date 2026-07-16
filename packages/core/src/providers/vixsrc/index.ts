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
 * 2. GET {embed_url} → HTML containing token, expires, playlist URL
 * 3. Build master URL: {playlist}?token={token}&expires={expires}&h=1
 * 4. GET master URL → m3u8 manifest with quality variants
 * 5. Wrap master URL through proxy
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

      // Step 2: Fetch embed page to extract token data
      const embedUrl = `${this.config.baseUrl}${apiData.src}`
      const embedRes = await fetch(embedUrl, {
        headers: this.headers,
        signal: AbortSignal.timeout(10_000),
      })
      if (!embedRes.ok) return this.emptyResult([this.errorDiagnostic(`Embed returned ${embedRes.status}`)])

      const html = await embedRes.text()
      const tokenData = this.extractTokenData(html)
      if (!tokenData) return this.emptyResult([this.errorDiagnostic('Failed to extract token data')])

      // Step 3: Build master URL
      const masterUrl = this.buildMasterUrl(tokenData)

      // Step 4: Fetch master playlist to verify it works
      const playlistRes = await fetch(masterUrl, {
        headers: { ...this.headers, Referer: embedUrl },
        signal: AbortSignal.timeout(10_000),
      })
      if (!playlistRes.ok) return this.emptyResult([this.errorDiagnostic(`Playlist returned ${playlistRes.status}`)])

      const playlist = await playlistRes.text()
      const variants = this.parseVariants(playlist)
      const bestResolution = variants.length > 0
        ? Math.max(...variants.map(v => v.resolution))
        : 1080

      const subtitles = this.parseSubtitles(playlist)

      const source: Source = {
        url: this.createProxyUrl(masterUrl, {
          ...this.headers,
          Referer: embedUrl,
        }, new Date(Number(tokenData.expires) * 1000).getTime()),
        type: 'hls',
        quality: `${bestResolution}p`,
        provider: { id: this.config.id, name: this.config.name },
        audioTracks: this.parseAudioTracks(playlist),
      }

      return { sources: [source], subtitles, diagnostics: [], expiresAt: new Date(Number(tokenData.expires) * 1000).toISOString() }
    } catch (err: any) {
      return this.emptyResult([this.errorDiagnostic(err.message)])
    }
  }

  private extractTokenData(html: string): { token: string; expires: string; playlist: string } | null {
    const token = html.match(/token['"]\s*:\s*['"]([^'"]+)/)?.[1]
    const expires = html.match(/expires['"]\s*:\s*['"]([^'"]+)/)?.[1]
    const playlist = html.match(/url\s*:\s*['"]([^'"]+)/)?.[1]

    if (!token || !expires || !playlist) return null

    // Check if token is expired. A non-numeric expires must be rejected here:
    // NaN compares false against everything, so it would sail through this
    // check and produce proxy URLs with an invalid expiry downstream.
    const expiresMs = Number(expires) * 1000
    if (!Number.isFinite(expiresMs) || expiresMs - 60_000 < Date.now()) return null

    return { token, expires, playlist }
  }

  private buildMasterUrl(data: { token: string; expires: string; playlist: string }): string {
    const separator = data.playlist.includes('?') ? '&' : '?'
    return `${data.playlist}${separator}token=${data.token}&expires=${data.expires}&h=1`
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
      if (!line.startsWith('#EXT-X-MEDIA:TYPE=AUDIO')) continue
      const language = line.match(/LANGUAGE="([^"]+)"/)?.[1] ?? 'unknown'
      const label = line.match(/NAME="([^"]+)"/)?.[1] ?? 'Audio'
      tracks.push({ language, label })
    }
    return tracks
  }

  private parseSubtitles(content: string): Subtitle[] {
    const subtitles: Subtitle[] = []
    for (const line of content.split('\n')) {
      if (!line.startsWith('#EXT-X-MEDIA:TYPE=SUBTITLES')) continue
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
