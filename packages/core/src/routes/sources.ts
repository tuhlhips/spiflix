import type { FastifyInstance } from 'fastify'
import { sourceCache } from '../services/cache.js'
import { proxyBase } from '../services/proxy.js'

function cacheResult(key: string, result: { expiresAt: string }): void {
  // Refresh before a provider token expires; never keep playback URLs longer
  // than five minutes when the provider does not supply an expiry.
  const ttl = Math.max(1, Math.min(300, Math.floor((Date.parse(result.expiresAt) - Date.now() - 30_000) / 1000)))
  sourceCache.set(key, result, ttl)
}

/**
 * Source routes — resolve streaming URLs for movies/TV.
 *
 * Flow: TMDB ID → providers scrape in parallel → cache → response.
 * Cache key is based on TMDB ID + season/episode for TV.
 */
export async function sourceRoutes(app: FastifyInstance) {
  /** GET /v1/movies/:tmdbId — get sources for a movie */
  app.get('/v1/movies/:tmdbId', async (request, reply) => {
    const { tmdbId } = request.params as { tmdbId: string }
    const id = Number(tmdbId)
    if (!Number.isSafeInteger(id) || id <= 0) {
      return reply.code(400).send({ error: 'Invalid TMDB ID' })
    }

    const cacheKey = `movie:${id}`
    const cached = sourceCache.get(cacheKey)
    if (cached) {
      reply.header('X-Cache', 'HIT')
      return cached
    }

    try {
      // TODO: resolve title/year from TMDB before passing to providers
      const result = await app.registry.resolveSources(
        { tmdbId: id, title: '', imdbId: null, releaseYear: null, type: 'movie' },
        proxyBase(),
      )

      request.log.info(`movie:${id} → ${result.sources.length} sources, ${result.diagnostics.length} diagnostics`)
      if (result.diagnostics.length > 0) {
        // Full diagnostics only at debug — dumping the JSON at info drowned
        // the prod logs on every cache miss.
        request.log.debug({ diagnostics: result.diagnostics }, `movie:${id} diagnostics`)
      }

      cacheResult(cacheKey, result)
      reply.header('X-Cache', 'MISS')
      return result
    } catch (err: any) {
      request.log.error(err)
      return reply.code(500).send({ error: 'Failed to resolve sources' })
    }
  })

  /** GET /v1/tv/:tmdbId/seasons/:season/episodes/:episode — get sources for a TV episode */
  app.get('/v1/tv/:tmdbId/seasons/:season/episodes/:episode', async (request, reply) => {
    const { tmdbId, season, episode } = request.params as {
      tmdbId: string
      season: string
      episode: string
    }
    const id = Number(tmdbId)
    const s = Number(season)
    const e = Number(episode)
    if (![id, s, e].every(value => Number.isSafeInteger(value) && value > 0)) {
      return reply.code(400).send({ error: 'Invalid parameters' })
    }

    const cacheKey = `tv:${id}:s${s}:e${e}`
    const cached = sourceCache.get(cacheKey)
    if (cached) {
      reply.header('X-Cache', 'HIT')
      return cached
    }

    try {
      const result = await app.registry.resolveSources(
        { tmdbId: id, title: '', imdbId: null, releaseYear: null, type: 'tv', season: s, episode: e },
        proxyBase(),
      )

      cacheResult(cacheKey, result)
      reply.header('X-Cache', 'MISS')
      return result
    } catch (err: any) {
      request.log.error(err)
      return reply.code(500).send({ error: 'Failed to resolve sources' })
    }
  })
}
