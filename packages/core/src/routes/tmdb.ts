import type { FastifyInstance } from 'fastify'
import { tmdb } from '../services/tmdb.js'

/**
 * TMDB proxy routes — proxies metadata requests from the frontend.
 *
 * Why proxy instead of direct client calls: keeps the API key
 * server-side, avoids CORS issues, allows caching.
 */
export async function tmdbRoutes(app: FastifyInstance) {
  function getLang(request: any): string {
    return (request.query as any).language || 'en-US'
  }

  function getRegion(request: any): string {
    return (request.query as any).region || 'US'
  }

  /** GET /api/tmdb/search?q=... — search movies and TV */
  app.get('/api/tmdb/search', async (request, reply) => {
    const { q, page } = request.query as { q?: string; page?: string }
    if (!q) return reply.code(400).send({ error: 'Missing query' })

    try {
      const results = await tmdb.search(q, Number(page) || 1, getLang(request))
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
      console.error('[TMDB] trending error:', err.message, err.stack)
      return reply.code(500).send({ error: 'TMDB trending failed', detail: err.message })
    }
  })

  /** GET /api/tmdb/popular/:mediaType — popular movies or TV */
  app.get('/api/tmdb/popular/:mediaType', async (request, reply) => {
    const { mediaType } = request.params as { mediaType: string }
    const { page } = request.query as { page?: string }
    if (mediaType !== 'movie' && mediaType !== 'tv') {
      return reply.code(400).send({ error: 'Invalid media type' })
    }

    try {
      const results = mediaType === 'movie'
        ? await tmdb.popularMovies(Number(page) || 1, getLang(request), getRegion(request))
        : await tmdb.popularTv(Number(page) || 1, getLang(request))
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
    if (mediaType !== 'movie' && mediaType !== 'tv') {
      return reply.code(400).send({ error: 'Invalid media type' })
    }

    try {
      const results = mediaType === 'movie'
        ? await tmdb.topRatedMovies(Number(page) || 1, getLang(request))
        : await tmdb.topRatedTv(Number(page) || 1, getLang(request))
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

  /** GET /api/tmdb/:mediaType/:id — media details */
  app.get('/api/tmdb/:mediaType/:id', async (request, reply) => {
    const { mediaType, id } = request.params as { mediaType: string; id: string }
    const tmdbId = Number(id)
    if (isNaN(tmdbId)) return reply.code(400).send({ error: 'Invalid ID' })

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
    const tmdbId = Number(id)
    const seasonNum = Number(season)
    if (isNaN(tmdbId) || isNaN(seasonNum)) {
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
