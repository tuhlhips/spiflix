import type { SourceResponse } from './source.js'
import type { ProviderHealth } from './provider.js'

/** API response wrapper */
export interface ApiResponse<T> {
  ok: boolean
  data?: T
  error?: ApiError
  meta?: ResponseMeta
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, unknown>
}

export interface ResponseMeta {
  timestamp: string
  requestId: string
  cacheHit: boolean
}

/** Health check response */
export interface HealthResponse {
  status: 'ok' | 'degraded' | 'down'
  timestamp: string
  version: string
  providers: ProviderHealth[]
  uptime: number
}

/** Source request params */
export interface SourceRequestParams {
  tmdbId: number
  season?: number
  episode?: number
}

/** TMDB search result (normalized) */
export interface SearchResult {
  id: number
  type: 'movie' | 'tv'
  title: string
  overview: string
  posterPath: string | null
  backdropPath: string | null
  releaseDate: string
  rating: number
}

/** Discover filter params */
export interface DiscoverParams {
  type: 'movie' | 'tv'
  genre?: number
  year?: number
  sortBy?: string
  page?: number
}
