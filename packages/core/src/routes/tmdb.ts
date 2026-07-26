import type { FastifyInstance } from 'fastify'
import { tmdb } from '../services/tmdb.js'

/**
 * TMDB proxy routes — proxies metadata requests from the frontend.
 *
 * Why proxy instead of direct client calls: keeps the API key
 * server-side, avoids CORS issues, allows caching.
 */
export async function tmdbRoutes(app: FastifyInstance) {
  const MAX_PAGE = 500
  const MIN_YEAR = 1870
  const MAX_YEAR = new Date().getFullYear() + 5
  const discoverSorts = new Set(['popularity.desc', 'popularity.asc', 'vote_average.desc', 'vote_average.asc', 'primary_release_date.desc', 'primary_release_date.asc', 'first_air_date.desc', 'first_air_date.asc', 'original_title.asc', 'original_title.desc'])

  function positiveInteger(value: string | undefined, max = Number.MAX_SAFE_INTEGER): number | null {
    if (!value || !/^\d+$/.test(value)) return null
    const parsed = Number(value)
    return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= max ? parsed : null
  }

  function getLang(request: any): string {
    return (request.query as any).language || 'en-US'
  }

  function getRegion(request: any): string {
    return (request.query as any).region || 'US'
  }

  /** GET /api/tmdb/search?q=... — search movies and TV */
  app.get('/api/tmdb/search', async (request, reply) => {
    const { q, page } = request.query as { q?: string; page?: string }
    const parsedPage = page === undefined ? 1 : positiveInteger(page, MAX_PAGE)
    if (!q || q.trim().length === 0 || q.trim().length > 200) return reply.code(400).send({ error: 'Invalid query' })
    if (parsedPage === null) return reply.code(400).send({ error: 'Invalid page' })

    try {
      const results = await tmdb.search(q.trim(), parsedPage, getLang(request))
      return results
    } catch (err: any) {
      request.log.error(err)
      return reply.code(500).send({ error: 'TMDB search failed' })
    }
  })

  /** GET /api/tmdb/trending/:mediaType — trending movies or TV */
  app.get('/api/tmdb/trending/:mediaType', async (request, reply) => {
    const { mediaType } = request.params as { mediaType: string }
    if (mediaType !== 'movie' && mediaType !== 'tv') {
      return reply.code(400).send({ error: 'Invalid media type' })
    }

    try {
      const results = mediaType === 'movie'
        ? await tmdb.trending('week', getLang(request))
        : await tmdb.trendingTv('week', getLang(request))
      return results
    } catch (err: any) {
      request.log.error(err, 'TMDB trending failed')
      return reply.code(500).send({ error: 'TMDB trending failed' })
    }
  })

  /** GET /api/tmdb/popular/:mediaType — popular movies or TV */
  app.get('/api/tmdb/popular/:mediaType', async (request, reply) => {
    const { mediaType } = request.params as { mediaType: string }
    const { page } = request.query as { page?: string }
    const parsedPage = page === undefined ? 1 : positiveInteger(page, MAX_PAGE)
    if (mediaType !== 'movie' && mediaType !== 'tv') {
      return reply.code(400).send({ error: 'Invalid media type' })
    }
    if (parsedPage === null) return reply.code(400).send({ error: 'Invalid page' })

    try {
      const results = mediaType === 'movie'
        ? await tmdb.popularMovies(parsedPage, getLang(request), getRegion(request))
        : await tmdb.popularTv(parsedPage, getLang(request))
      return results
    } catch (err: any) {
      request.log.error(err)
      return reply.code(500).send({ error: 'TMDB popular failed' })
    }
  })

  /** GET /api/tmdb/top-rated/:mediaType — top rated */
  app.get('/api/tmdb/top-rated/:mediaType', async (request, reply) => {
    const { mediaType } = request.params as { mediaType: string }
    const { page } = request.query as { page?: string }
    const parsedPage = page === undefined ? 1 : positiveInteger(page, MAX_PAGE)
    if (mediaType !== 'movie' && mediaType !== 'tv') {
      return reply.code(400).send({ error: 'Invalid media type' })
    }
    if (parsedPage === null) return reply.code(400).send({ error: 'Invalid page' })

    try {
      const results = mediaType === 'movie'
        ? await tmdb.topRatedMovies(parsedPage, getLang(request))
        : await tmdb.topRatedTv(parsedPage, getLang(request))
      return results
    } catch (err: any) {
      request.log.error(err)
      return reply.code(500).send({ error: 'TMDB top-rated failed' })
    }
  })

  /** GET /api/tmdb/genres/:mediaType — genre list */
  app.get('/api/tmdb/genres/:mediaType', async (request, reply) => {
    const { mediaType } = request.params as { mediaType: string }
    if (mediaType !== 'movie' && mediaType !== 'tv') {
      return reply.code(400).send({ error: 'Invalid media type' })
    }

    try {
      const results = mediaType === 'movie'
        ? await tmdb.movieGenres(getLang(request))
        : await tmdb.tvGenres(getLang(request))
      return results
    } catch (err: any) {
      request.log.error(err)
      return reply.code(500).send({ error: 'TMDB genres failed' })
    }
  })

  /** GET /api/tmdb/discover/:mediaType — browse media with sort, genre, and date filters. */
  app.get('/api/tmdb/discover/:mediaType', async (request, reply) => {
    const { mediaType } = request.params as { mediaType: string }
    if (mediaType !== 'movie' && mediaType !== 'tv') {
      return reply.code(400).send({ error: 'Invalid media type' })
    }

    const query = request.query as {
      page?: string
      sort_by?: string
      with_genres?: string
      year_from?: string
      year_to?: string
    }
    const parsedPage = query.page === undefined ? 1 : positiveInteger(query.page, MAX_PAGE)
    const genreId = query.with_genres === undefined ? undefined : positiveInteger(query.with_genres)
    const yearFrom = query.year_from === undefined ? undefined : positiveInteger(query.year_from, MAX_YEAR)
    const yearTo = query.year_to === undefined ? undefined : positiveInteger(query.year_to, MAX_YEAR)
    if (parsedPage === null || genreId === null || yearFrom === null || yearTo === null || (yearFrom !== undefined && yearFrom < MIN_YEAR) || (yearTo !== undefined && yearTo < MIN_YEAR) || (yearFrom !== undefined && yearTo !== undefined && yearFrom > yearTo) || (query.sort_by !== undefined && !discoverSorts.has(query.sort_by))) {
      return reply.code(400).send({ error: 'Invalid discover parameters' })
    }

    try {
      return await tmdb.discover(mediaType, {
        page: parsedPage,
        sortBy: query.sort_by,
        genreId,
        yearFrom,
        yearTo,
        language: getLang(request),
        region: getRegion(request),
      })
    } catch (err: any) {
      request.log.error(err)
      return reply.code(500).send({ error: 'TMDB discover failed' })
    }
  })

  /** GET /api/tmdb/:mediaType/:id — media details */
  app.get('/api/tmdb/:mediaType/:id', async (request, reply) => {
    const { mediaType, id } = request.params as { mediaType: string; id: string }
    const tmdbId = Number(id)
    if ((mediaType !== 'movie' && mediaType !== 'tv') || !Number.isSafeInteger(tmdbId) || tmdbId <= 0) {
      return reply.code(400).send({ error: 'Invalid media type or ID' })
    }

    try {
      const results = mediaType === 'movie'
        ? await tmdb.movieDetails(tmdbId, getLang(request))
        : await tmdb.tvDetails(tmdbId, getLang(request))
      return results
    } catch (err: any) {
      request.log.error(err)
      return reply.code(500).send({ error: 'TMDB details failed' })
    }
  })

  /** GET /api/tmdb/:mediaType/:id/season/:season — season details */
  app.get('/api/tmdb/:mediaType/:id/season/:season', async (request, reply) => {
    const { id, season } = request.params as { id: string; season: string }
    const tmdbId = positiveInteger(id)
    const seasonNum = positiveInteger(season, 999)
    if (tmdbId === null || seasonNum === null) {
      return reply.code(400).send({ error: 'Invalid parameters' })
    }

    try {
      return await tmdb.seasonDetails(tmdbId, seasonNum, getLang(request))
    } catch (err: any) {
      request.log.error(err)
      return reply.code(500).send({ error: 'TMDB season details failed' })
    }
  })
}
