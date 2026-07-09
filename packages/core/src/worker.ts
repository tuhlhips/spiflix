import { ProviderRegistry } from './providers/registry.js'
import { proxyRequest } from './services/proxy.js'
import { tmdb } from './services/tmdb.js'
import { sourceCache, tmdbCache } from './services/cache.js'

/**
 * Cloudflare Worker entry point.
 *
 * Same provider logic as the Fastify server, but uses
 * the Workers fetch handler instead of Fastify's HTTP layer.
 */

let registry: ProviderRegistry | null = null

async function getRegistry(): Promise<ProviderRegistry> {
  if (!registry) {
    registry = new ProviderRegistry()
    await registry.discover()
  }
  return registry
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

function cors(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const path = url.pathname

  // CORS preflight
  if (req.method === 'OPTIONS') return cors()

  // --- Health ---
  if (path === '/api/health') {
    const reg = await getRegistry()
    return json({ status: 'ok', version: '0.1.0', providers: reg.getAll().length })
  }

  // --- Proxy ---
  if (path === '/v1/proxy') {
    const data = url.searchParams.get('data')
    if (!data) return json({ error: 'Missing data parameter' }, 400)

    return proxyRequest(data)
  }

  // --- Sources ---
  const movieMatch = path.match(/^\/v1\/movies\/(\d+)$/)
  if (movieMatch) {
    const tmdbId = Number(movieMatch[1])
    const cacheKey = `movie:${tmdbId}`
    const cached = sourceCache.get(cacheKey)
    if (cached) return json(cached)

    const reg = await getRegistry()
    const result = await reg.resolveSources(
      { tmdbId, title: '', imdbId: null, releaseYear: null, type: 'movie' },
      url.origin,
    )
    sourceCache.set(cacheKey, result)
    return json(result)
  }

  const tvMatch = path.match(/^\/v1\/tv\/(\d+)\/seasons\/(\d+)\/episodes\/(\d+)$/)
  if (tvMatch) {
    const [, tmdbId, season, episode] = tvMatch.map(Number)
    const cacheKey = `tv:${tmdbId}:s${season}:e${episode}`
    const cached = sourceCache.get(cacheKey)
    if (cached) return json(cached)

    const reg = await getRegistry()
    const result = await reg.resolveSources(
      { tmdbId, title: '', imdbId: null, releaseYear: null, type: 'tv', season, episode },
      url.origin,
    )
    sourceCache.set(cacheKey, result)
    return json(result)
  }

  // --- TMDB ---
  const tmdbSearch = path === '/api/tmdb/search'
  if (tmdbSearch) {
    const q = url.searchParams.get('q')
    if (!q) return json({ error: 'Missing query' }, 400)
    const page = Number(url.searchParams.get('page')) || 1
    try {
      const results = await tmdb.search(q, page)
      return json(results)
    } catch (err: any) {
      return json({ error: err.message }, 500)
    }
  }

  const tmdbTrending = path.match(/^\/api\/tmdb\/trending\/(movie|tv)$/)
  if (tmdbTrending) {
    const type = tmdbTrending[1] as 'movie' | 'tv'
    try {
      const results = type === 'movie' ? await tmdb.trending() : await tmdb.trendingTv()
      return json(results)
    } catch (err: any) {
      return json({ error: err.message }, 500)
    }
  }

  const tmdbPopular = path.match(/^\/api\/tmdb\/popular\/(movie|tv)$/)
  if (tmdbPopular) {
    const type = tmdbPopular[1] as 'movie' | 'tv'
    const page = Number(url.searchParams.get('page')) || 1
    try {
      const results = type === 'movie' ? await tmdb.popularMovies(page) : await tmdb.popularTv(page)
      return json(results)
    } catch (err: any) {
      return json({ error: err.message }, 500)
    }
  }

  const tmdbTopRated = path.match(/^\/api\/tmdb\/top-rated\/(movie|tv)$/)
  if (tmdbTopRated) {
    const type = tmdbTopRated[1] as 'movie' | 'tv'
    const page = Number(url.searchParams.get('page')) || 1
    try {
      const results = type === 'movie' ? await tmdb.topRatedMovies(page) : await tmdb.topRatedTv(page)
      return json(results)
    } catch (err: any) {
      return json({ error: err.message }, 500)
    }
  }

  const tmdbGenres = path.match(/^\/api\/tmdb\/genres\/(movie|tv)$/)
  if (tmdbGenres) {
    const type = tmdbGenres[1] as 'movie' | 'tv'
    try {
      const results = type === 'movie' ? await tmdb.movieGenres() : await tmdb.tvGenres()
      return json(results)
    } catch (err: any) {
      return json({ error: err.message }, 500)
    }
  }

  const tmdbDetails = path.match(/^\/api\/tmdb\/(movie|tv)\/(\d+)$/)
  if (tmdbDetails) {
    const [, type, id] = tmdbDetails
    try {
      const results = type === 'movie'
        ? await tmdb.movieDetails(Number(id))
        : await tmdb.tvDetails(Number(id))
      return json(results)
    } catch (err: any) {
      return json({ error: err.message }, 500)
    }
  }

  const tmdbSeason = path.match(/^\/api\/tmdb\/tv\/(\d+)\/season\/(\d+)$/)
  if (tmdbSeason) {
    const [, tvId, season] = tmdbSeason
    try {
      return json(await tmdb.seasonDetails(Number(tvId), Number(season)))
    } catch (err: any) {
      return json({ error: err.message }, 500)
    }
  }

  // --- 404 ---
  return json({ error: 'Not found' }, 404)
}

export default {
  fetch: handleRequest,
}
