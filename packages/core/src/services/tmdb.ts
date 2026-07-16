import { env } from '../config/env.js'
import { tmdbCache } from './cache.js'

/**
 * TMDB API client with caching.
 *
 * Design: Thin wrapper around TMDB REST API. All responses are cached
 * to avoid hammering the API. Uses the discover endpoint for browsing
 * and the search endpoint for queries.
 */

interface TmdbResponse<T> {
  results: T[]
  total_results: number
  total_pages: number
  page: number
}

interface TmdbMovie {
  id: number
  title: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  release_date: string
  vote_average: number
  genre_ids: number[]
  media_type?: string
}

interface TmdbTv {
  id: number
  name: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  first_air_date: string
  vote_average: number
  genre_ids: number[]
  media_type?: string
}

interface TmdbMediaDetail {
  id: number
  title?: string
  name?: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  release_date?: string
  first_air_date?: string
  vote_average: number
  genres: { id: number; name: string }[]
  runtime: number | null
  tagline: string | null
  status: string
  number_of_seasons?: number
  number_of_episodes?: number
  seasons?: {
    id: number
    season_number: number
    name: string
    overview: string
    poster_path: string | null
    episode_count: number
    air_date: string | null
  }[]
}

/**
 * The UI sends movie-oriented sort keys unconditionally, but TMDB's
 * /discover/tv only accepts first_air_date.*, name.*, original_name.*,
 * popularity.*, vote_average.*, and vote_count.* — it rejects
 * primary_release_date.* and original_title.asc with a 400. Translate the
 * incoming key to its TV equivalent so Newest/Oldest/A-Z work on TV Shows.
 */
function sortByForType(type: 'movie' | 'tv', sortBy: string): string {
  if (type !== 'tv') return sortBy
  switch (sortBy) {
    case 'primary_release_date.desc': return 'first_air_date.desc'
    case 'primary_release_date.asc': return 'first_air_date.asc'
    case 'original_title.asc': return 'name.asc'
    default: return sortBy
  }
}

class TmdbService {
  private baseUrl = env.tmdb.baseUrl
  private imageBaseUrl = env.tmdb.imageBaseUrl

  private async fetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const cacheKey = `tmdb:${path}:${JSON.stringify(params)}`
    const cached = tmdbCache.get<T>(cacheKey)
    if (cached) return cached

    const url = new URL(`${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`)
    url.searchParams.set('api_key', env.tmdb.apiKey)
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v)
    }

    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      throw new Error(`TMDB API error: ${res.status} ${res.statusText}`)
    }

    const data = await res.json() as T
    tmdbCache.set(cacheKey, data, env.tmdb.cacheTtl)
    return data
  }

  /** Get trending movies */
  async trending(timeWindow: 'day' | 'week' = 'week', language = 'en-US'): Promise<TmdbMovie[]> {
    const data = await this.fetch<TmdbResponse<TmdbMovie>>(`/trending/movie/${timeWindow}`, { language })
    return data.results
  }

  /** Get trending TV shows */
  async trendingTv(timeWindow: 'day' | 'week' = 'week', language = 'en-US'): Promise<TmdbTv[]> {
    const data = await this.fetch<TmdbResponse<TmdbTv>>(`/trending/tv/${timeWindow}`, { language })
    return data.results
  }

  /** Get popular movies */
  async popularMovies(page = 1, language = 'en-US', region = 'US'): Promise<TmdbMovie[]> {
    const data = await this.fetch<TmdbResponse<TmdbMovie>>('/movie/popular', { page: String(page), language, region })
    return data.results
  }

  /** Add media_type to TMDB results that are missing it */
  private tagWith<T>(results: T[], mediaType: 'movie' | 'tv'): (T & { media_type: string })[] {
    return results.map(r => ({ ...r, media_type: mediaType }))
  }

  /** Get popular TV shows */
  async popularTv(page = 1, language = 'en-US'): Promise<TmdbTv[]> {
    const data = await this.fetch<TmdbResponse<TmdbTv>>('/tv/popular', { page: String(page), language })
    return this.tagWith(data.results, 'tv')
  }

  /** Get top-rated movies */
  async topRatedMovies(page = 1, language = 'en-US'): Promise<TmdbMovie[]> {
    const data = await this.fetch<TmdbResponse<TmdbMovie>>('/movie/top_rated', { page: String(page), language })
    return data.results
  }

  /** Get top-rated TV shows */
  async topRatedTv(page = 1, language = 'en-US'): Promise<TmdbTv[]> {
    const data = await this.fetch<TmdbResponse<TmdbTv>>('/tv/top_rated', { page: String(page), language })
    return this.tagWith(data.results, 'tv')
  }

  /** Get movies by genre */
  async moviesByGenre(genreId: number, page = 1, language = 'en-US'): Promise<TmdbMovie[]> {
    const data = await this.fetch<TmdbResponse<TmdbMovie>>('/discover/movie', {
      with_genres: String(genreId),
      page: String(page),
      language,
    })
    return data.results
  }

  /** Get TV shows by genre */
  async tvByGenre(genreId: number, page = 1, language = 'en-US'): Promise<TmdbTv[]> {
    const data = await this.fetch<TmdbResponse<TmdbTv>>('/discover/tv', {
      with_genres: String(genreId),
      page: String(page),
      language,
    })
    return this.tagWith(data.results, 'tv')
  }

  /** Browse media using the TMDB discover endpoint and the selected filters. */
  async discover(
    type: 'movie' | 'tv',
    options: {
      page?: number
      sortBy?: string
      genreId?: number
      yearFrom?: number
      yearTo?: number
      language?: string
      region?: string
    } = {},
  ): Promise<TmdbMovie[] | TmdbTv[]> {
    const params: Record<string, string> = {
      page: String(options.page || 1),
      sort_by: sortByForType(type, options.sortBy || 'popularity.desc'),
      language: options.language || 'en-US',
    }

    if (options.genreId) params.with_genres = String(options.genreId)
    if (options.yearFrom) {
      params[type === 'movie' ? 'primary_release_date.gte' : 'first_air_date.gte'] = `${options.yearFrom}-01-01`
    }
    if (options.yearTo) {
      params[type === 'movie' ? 'primary_release_date.lte' : 'first_air_date.lte'] = `${options.yearTo}-12-31`
    }
    // Only attach region when no year filter is active: TMDB switches
    // primary_release_date.* filtering to each title's *regional* release date
    // when a region is present, silently breaking the year range.
    if (type === 'movie' && options.region && !options.yearFrom && !options.yearTo) params.region = options.region

    const data = await this.fetch<TmdbResponse<TmdbMovie | TmdbTv>>(`/discover/${type}`, params)
    return type === 'tv'
      ? this.tagWith(data.results as TmdbTv[], 'tv')
      : data.results as TmdbMovie[]
  }

  /** Search movies and TV shows */
  async search(query: string, page = 1, language = 'en-US'): Promise<{ movies: TmdbMovie[]; tv: TmdbTv[] }> {
    const [movieData, tvData] = await Promise.all([
      this.fetch<TmdbResponse<TmdbMovie>>('/search/movie', { query, page: String(page), language }),
      this.fetch<TmdbResponse<TmdbTv>>('/search/tv', { query, page: String(page), language }),
    ])
    return { movies: movieData.results, tv: tvData.results }
  }

  /** Get movie details */
  async movieDetails(id: number, language = 'en-US'): Promise<TmdbMediaDetail> {
    return this.fetch<TmdbMediaDetail>(`/movie/${id}`, { append_to_response: 'videos,credits,recommendations,images,external_ids', language })
  }

  /** Get TV show details */
  async tvDetails(id: number, language = 'en-US'): Promise<TmdbMediaDetail> {
    return this.fetch<TmdbMediaDetail>(`/tv/${id}`, { append_to_response: 'videos,credits,recommendations,images,external_ids', language })
  }

  /** Get season details for a TV show */
  async seasonDetails(tvId: number, seasonNumber: number, language = 'en-US') {
    return this.fetch(`/tv/${tvId}/season/${seasonNumber}`, { language })
  }

  /** Get movie genres */
  async movieGenres(language = 'en-US'): Promise<{ id: number; name: string }[]> {
    const data = await this.fetch<{ genres: { id: number; name: string }[] }>('/genre/movie/list', { language })
    return data.genres
  }

  /** Get TV genres */
  async tvGenres(language = 'en-US'): Promise<{ id: number; name: string }[]> {
    const data = await this.fetch<{ genres: { id: number; name: string }[] }>('/genre/tv/list', { language })
    return data.genres
  }

  /** Build image URL from TMDB path */
  imageUrl(path: string | null, size: 'w92' | 'w154' | 'w185' | 'w342' | 'w500' | 'w780' | 'original' = 'w500'): string | null {
    if (!path) return null
    return `${this.imageBaseUrl}/${size}${path}`
  }

  /** Resolve IMDB ID from TMDB */
  async getImdbId(tmdbId: number, type: 'movie' | 'tv'): Promise<string | null> {
    try {
      const data = await this.fetch<{ imdb_id?: string }>(`/${type}/${tmdbId}/external_ids`)
      return data.imdb_id || null
    } catch {
      return null
    }
  }
}

export const tmdb = new TmdbService()
