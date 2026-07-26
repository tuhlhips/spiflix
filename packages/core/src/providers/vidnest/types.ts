// VidNest returns a different JSON shape per upstream server. These are the
// shapes for the servers we handle; anything else is skipped. Trimmed from
// CinePro Core (cinepro-org/core) and de-duplicated (the upstream file
// declared `vidlinkStream` twice).

export interface KlikxxiResponse {
  sources: { quality: string; type: string; url: string }[]
  title: string
  year: string
}

export interface AllmoviesResponse {
  streams: { headers: Record<string, string>; language: string; type: string; url: string }[]
  totalLanguages: number
}

export interface OnehdResponse {
  headers: Record<string, string>
  subtitles: { lang: string; url: string }[]
  url: string
}

// Shape observed 2026-07: { streams: [{language: 'MAIN'|'LS-25'|…, type, url}] }.
// The old { sources: [{file,label}] } shape is gone — mapping it yielded zero
// sources and silently killed this server.
export interface HollymoviehdResponse {
  streams: { language: string; type: string; url: string }[]
  totalLanguages: number
}

// Shape observed 2026-07: stream.playlist was replaced by deliveryType:'file'
// + per-quality mp4 entries (moviebox vault re-signed via vidlink), each with
// its own headers and a signed `t=` expiry.
export interface VidlinkResponse {
  data: {
    sourceId: string
    stream: {
      TTL: number
      captions: { language: string; type: string; url: string }[]
      flags: string[]
      id: string
      deliveryType?: string
      qualities?: Record<string, { headers?: Record<string, string>; requiresProxy?: boolean; type: string; url: string }>
      /** Legacy HLS shape — kept so an upstream revert keeps working. */
      playlist?: string
      type?: string
    }
  }
  headers: Record<string, string>
  provider: string
}

export interface DeltaResponse {
  streams: { headers: Record<string, string>; language: string; type: string; url: string }[]
  totalLanguages: number
}

export interface PurstreamResponse {
  purstream_id: number
  sources: { format: string; name: string; url: string }[]
  title: string
}

export interface MovieboxSource {
  headers: Record<string, string>
  needConfig: boolean
  provider: string
  proxy: boolean
  url: { lang: string; link: string; resolution: string; type: string }[]
}

export interface ServerMap {
  allmovies: AllmoviesResponse
  hollymoviehd: HollymoviehdResponse
  vidlink: VidlinkResponse
  onehd: OnehdResponse
  klikxxi: KlikxxiResponse
  purstream: PurstreamResponse
  delta: DeltaResponse
  moviebox: MovieboxSource
}

export type SupportedServer = keyof ServerMap
