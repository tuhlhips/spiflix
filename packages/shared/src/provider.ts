import type { Source, Subtitle, Diagnostic } from './source.js'

/** Media object passed to providers for scraping */
export interface ProviderMediaObject {
  tmdbId: number
  title: string
  imdbId: string | null
  releaseYear: number | null
  type: 'movie' | 'tv'
  season?: number
  episode?: number
}

/** Result from a provider scrape */
export interface ProviderResult {
  sources: Source[]
  subtitles: Subtitle[]
  diagnostics: Diagnostic[]
  /** Earliest upstream token expiry, when the provider exposes one. */
  expiresAt?: string
}

/** Provider capabilities */
export interface ProviderCapabilities {
  movies: boolean
  tv: boolean
  subtitles: boolean
}

/** Provider configuration */
export interface ProviderConfig {
  id: string
  name: string
  enabled: boolean
  baseUrl: string
  capabilities: ProviderCapabilities
}

/** Abstract provider interface — all scrapers implement this */
export interface IProvider {
  readonly config: ProviderConfig

  getMovieSources(media: ProviderMediaObject): Promise<ProviderResult>
  getTVSources(media: ProviderMediaObject): Promise<ProviderResult>
  healthCheck(): Promise<boolean>
}

/** Health status for a provider */
export interface ProviderHealth {
  id: string
  name: string
  healthy: boolean
  latencyMs: number
}
