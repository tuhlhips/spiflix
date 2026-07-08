/** Streaming source format */
export type SourceType = 'hls' | 'mpd' | 'mp4' | 'mkv' | 'webm'

/** A single streaming source */
export interface Source {
  url: string
  type: SourceType
  quality: string
  provider: ProviderRef
  audioTracks: AudioTrack[]
}

/** Provider reference embedded in source */
export interface ProviderRef {
  id: string
  name: string
}

/** Audio track */
export interface AudioTrack {
  language: string
  label: string
}

/** Subtitle */
export interface Subtitle {
  url: string
  label: string
  format: SubtitleFormat
}

export type SubtitleFormat = 'vtt' | 'srt' | 'ass' | 'json'

/** Complete source response from the backend */
export interface SourceResponse {
  responseId: string
  expiresAt: string
  sources: Source[]
  subtitles: Subtitle[]
  diagnostics: Diagnostic[]
}

/** Diagnostic information from providers */
export interface Diagnostic {
  code: DiagnosticCode
  message: string
  field: string
  severity: 'error' | 'warning' | 'info'
}

export type DiagnosticCode =
  | 'PROVIDER_ERROR'
  | 'PARTIAL_SCRAPE'
  | 'QUALITY_INFERRED'
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'BLOCKED'

/** Normalized source for the player */
export interface NormalizedSource {
  url: string
  type: SourceType
  quality: string
  provider: ProviderRef
  audioTracks: AudioTrack[]
  preferred: boolean
}

/** Playback bundle — all data the player needs */
export interface PlaybackBundle {
  sources: NormalizedSource[]
  subtitles: NormalizedSubtitle[]
  selectedSource: NormalizedSource | null
  selectedSubtitle: NormalizedSubtitle | null
}

/** Normalized subtitle for the player */
export interface NormalizedSubtitle {
  url: string
  label: string
  format: SubtitleFormat
}
