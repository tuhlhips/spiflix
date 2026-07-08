/** Media type discriminator */
export type MediaType = 'movie' | 'tv'

/** TMDB media identifier */
export interface MediaId {
  tmdbId: number
  type: MediaType
}

/** Episode identifier for TV shows */
export interface EpisodeId extends MediaId {
  type: 'tv'
  season: number
  episode: number
}

/** Minimal media metadata (used in lists/rails) */
export interface MediaSummary {
  id: number
  type: MediaType
  title: string
  overview: string
  posterPath: string | null
  backdropPath: string | null
  releaseDate: string
  rating: number
  genreIds: number[]
}

/** Full media details (used in drawer/player) */
export interface MediaDetail extends MediaSummary {
  genres: Genre[]
  runtime: number | null
  tagline: string | null
  status: string
  budget: number | null
  revenue: number | null
  productionCompanies: { id: number; name: string; logoPath: string | null }[]
  spokenLanguages: { iso: string; name: string }[]
  belongsToCollection: { id: number; name: string; posterPath: string | null } | null
}

/** TV-specific extensions */
export interface TvDetail extends MediaDetail {
  number_of_seasons: number
  number_of_episodes: number
  seasons: SeasonInfo[]
  episode_run_time: number[]
  created_by: { id: number; name: string; profilePath: string | null }[]
  networks: { id: number; name: string; logoPath: string | null }[]
}

export interface SeasonInfo {
  id: number
  seasonNumber: number
  name: string
  overview: string
  posterPath: string | null
  episodeCount: number
  airDate: string | null
}

export interface EpisodeInfo {
  id: number
  episodeNumber: number
  seasonNumber: number
  name: string
  overview: string
  stillPath: string | null
  airDate: string | null
  runtime: number | null
  rating: number
}

export interface Genre {
  id: number
  name: string
}

export interface CastMember {
  id: number
  name: string
  character: string
  profilePath: string | null
  order: number
}

export interface Video {
  id: string
  key: string
  name: string
  site: string
  type: string
  official: boolean
}

/** Normalized media for the player — unified movie + TV */
export interface UnifiedMedia {
  id: number
  type: MediaType
  title: string
  overview: string
  posterUrl: string | null
  backdropUrl: string | null
  releaseDate: string
  rating: number
  seasonNumber?: number
  episodeNumber?: number
  episodeTitle?: string
  runtime: number | null
}
