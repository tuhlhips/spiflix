import { ProviderRegistry } from './providers/registry.js'
import VixSrcProvider from './providers/vixsrc/index.js'
import { proxyRequest } from './services/proxy.js'
import { tmdb } from './services/tmdb.js'
import { sourceCache } from './services/cache.js'

/**
 * Cloudflare Worker entry point.
 *
 * Same provider logic as the Fastify server, but uses
 * the Workers fetch handler instead of Fastify's HTTP layer.
 */

let registry: ProviderRegistry | null = null
const requestBuckets = new Map<string, { count: number; resetAt: number }>()

async function getRegistry(): Promise<ProviderRegistry> {
  if (!registry) {
    registry = new ProviderRegistry()
    // Static registration, NOT registry.discover(): discovery walks the
    // filesystem (readdir + dynamic import), which doesn't exist in the
    // Workers runtime and can't be bundled. New providers must be added here
    // as well as in the providers/ directory (Fastify still auto-discovers).
    registry.register(new VixSrcProvider())
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
      'Access-Control-Allow-Headers': 'Content-Type, Range',
    },
  })
}

function cors(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Range',
    },
  })
}

function language(url: URL): string { return url.searchParams.get('language') || 'en-US' }
function region(url: URL): string { return url.searchParams.get('region') || 'US' }
function page(url: URL): number | null {
  const raw = url.searchParams.get('page')
  if (raw === null) return 1
  if (!/^\d+$/.test(raw)) return null
  const value = Number(raw)
  return Number.isSafeInteger(value) && value >= 1 && value <= 500 ? value : null
}
function cacheSource(key: string, result: { expiresAt: string }): void {
  const ttl = Math.max(1, Math.min(300, Math.floor((Date.parse(result.expiresAt) - Date.now() - 30_000) / 1000)))
  sourceCache.set(key, result, ttl)
}

async function route(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const path = url.pathname

  // CORS preflight
  if (req.method === 'OPTIONS') return cors()
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)

  // Workers do not share Fastify's limiter. This per-isolate limiter is a
  // lightweight backstop; production deployments should also configure an
  // edge/WAF rate-limit rule.
  const client = req.headers.get('CF-Connecting-IP') || 'unknown'
  const now = Date.now()
  // Evict expired buckets so the map can't grow unboundedly with unique
  // client IPs (the exact resource-exhaustion this limiter exists to prevent).
  if (requestBuckets.size > 10_000) {
    for (const [ip, b] of requestBuckets) {
      if (now >= b.resetAt) requestBuckets.delete(ip)
    }
  }
  const bucket = requestBuckets.get(client)
  if (!bucket || now >= bucket.resetAt) requestBuckets.set(client, { count: 1, resetAt: now + 1000 })
  else if (bucket.count >= 100) return json({ error: 'Too many requests' }, 429)
  else bucket.count += 1

  // --- Health ---
  if (path === '/api/health') {
    const reg = await getRegistry()
    return json({ status: 'ok', version: '0.1.0', providers: reg.getAll().length })
  }

  // Parity with app.ts's healthRoutes. (app.ts's dev-only /api/debug is
  // deliberately absent here — it exposes internals and has no place in an
  // always-production edge deployment.)
  if (path === '/api/health/providers') {
    const reg = await getRegistry()
    const checks = await reg.healthCheckAll()
    const healthy = checks.filter(c => c.healthy).length
    return json({ status: healthy === checks.length ? 'ok' : 'degraded', providers: checks })
  }

  // --- Proxy ---
  if (path === '/v1/proxy') {
    const data = url.searchParams.get('data')
    const signature = url.searchParams.get('sig')
    if (!data) return json({ error: 'Missing data parameter' }, 400)

    return proxyRequest(data, { range: req.headers.get('range') ?? undefined, signature: signature ?? undefined })
  }

  // --- Sources ---
  const movieMatch = path.match(/^\/v1\/movies\/(\d+)$/)
  if (movieMatch) {
    const tmdbId = Number(movieMatch[1])
    if (!Number.isSafeInteger(tmdbId) || tmdbId <= 0) return json({ error: 'Invalid TMDB ID' }, 400)
    const cacheKey = `movie:${tmdbId}`
    const cached = sourceCache.get(cacheKey)
    if (cached) return json(cached)

    const reg = await getRegistry()
    const result = await reg.resolveSources(
      { tmdbId, title: '', imdbId: null, releaseYear: null, type: 'movie' },
      url.origin,
    )
    cacheSource(cacheKey, result)
    return json(result)
  }

  const tvMatch = path.match(/^\/v1\/tv\/(\d+)\/seasons\/(\d+)\/episodes\/(\d+)$/)
  if (tvMatch) {
    const [, tmdbId, season, episode] = tvMatch.map(Number)
    if (![tmdbId, season, episode].every(value => Number.isSafeInteger(value) && value > 0)) return json({ error: 'Invalid parameters' }, 400)
    const cacheKey = `tv:${tmdbId}:s${season}:e${episode}`
    const cached = sourceCache.get(cacheKey)
    if (cached) return json(cached)

    const reg = await getRegistry()
    const result = await reg.resolveSources(
      { tmdbId, title: '', imdbId: null, releaseYear: null, type: 'tv', season, episode },
      url.origin,
    )
    cacheSource(cacheKey, result)
    return json(result)
  }

  // --- TMDB ---
  const tmdbSearch = path === '/api/tmdb/search'
  if (tmdbSearch) {
    const q = url.searchParams.get('q')
    const requestPage = page(url)
    if (!q || q.trim().length === 0 || q.trim().length > 200) return json({ error: 'Invalid query' }, 400)
    if (requestPage === null) return json({ error: 'Invalid page' }, 400)
    try {
      const results = await tmdb.search(q.trim(), requestPage, language(url))
      return json(results)
    } catch (err: any) {
      return json({ error: err.message }, 500)
    }
  }

  const tmdbTrending = path.match(/^\/api\/tmdb\/trending\/(movie|tv)$/)
  if (tmdbTrending) {
    const type = tmdbTrending[1] as 'movie' | 'tv'
    try {
      const results = type === 'movie' ? await tmdb.trending('week', language(url)) : await tmdb.trendingTv('week', language(url))
      return json(results)
    } catch (err: any) {
      return json({ error: err.message }, 500)
    }
  }

  const tmdbPopular = path.match(/^\/api\/tmdb\/popular\/(movie|tv)$/)
  if (tmdbPopular) {
    const type = tmdbPopular[1] as 'movie' | 'tv'
    const requestPage = page(url)
    if (requestPage === null) return json({ error: 'Invalid page' }, 400)
    try {
      const results = type === 'movie' ? await tmdb.popularMovies(requestPage, language(url), region(url)) : await tmdb.popularTv(requestPage, language(url))
      return json(results)
    } catch (err: any) {
      return json({ error: err.message }, 500)
    }
  }

  const tmdbTopRated = path.match(/^\/api\/tmdb\/top-rated\/(movie|tv)$/)
  if (tmdbTopRated) {
    const type = tmdbTopRated[1] as 'movie' | 'tv'
    const requestPage = page(url)
    if (requestPage === null) return json({ error: 'Invalid page' }, 400)
    try {
      const results = type === 'movie' ? await tmdb.topRatedMovies(requestPage, language(url)) : await tmdb.topRatedTv(requestPage, language(url))
      return json(results)
    } catch (err: any) {
      return json({ error: err.message }, 500)
    }
  }

  const tmdbGenres = path.match(/^\/api\/tmdb\/genres\/(movie|tv)$/)
  if (tmdbGenres) {
    const type = tmdbGenres[1] as 'movie' | 'tv'
    try {
      const results = type === 'movie' ? await tmdb.movieGenres(language(url)) : await tmdb.tvGenres(language(url))
      return json(results)
    } catch (err: any) {
      return json({ error: err.message }, 500)
    }
  }

  const tmdbDetails = path.match(/^\/api\/tmdb\/(movie|tv)\/(\d+)$/)
  if (tmdbDetails) {
    const [, type, id] = tmdbDetails
    const tmdbId = Number(id)
    if (!Number.isSafeInteger(tmdbId) || tmdbId <= 0) return json({ error: 'Invalid TMDB ID' }, 400)
    try {
      const results = type === 'movie'
        ? await tmdb.movieDetails(tmdbId, language(url))
        : await tmdb.tvDetails(tmdbId, language(url))
      return json(results)
    } catch (err: any) {
      return json({ error: err.message }, 500)
    }
  }

  const tmdbSeason = path.match(/^\/api\/tmdb\/tv\/(\d+)\/season\/(\d+)$/)
  if (tmdbSeason) {
    const [, tvId, season] = tmdbSeason
    const id = Number(tvId)
    const seasonNumber = Number(season)
    if (!Number.isSafeInteger(id) || id <= 0 || !Number.isSafeInteger(seasonNumber) || seasonNumber < 1 || seasonNumber > 999) return json({ error: 'Invalid parameters' }, 400)
    try {
      return json(await tmdb.seasonDetails(id, seasonNumber, language(url)))
    } catch (err: any) {
      return json({ error: err.message }, 500)
    }
  }

  const tmdbDiscover = path.match(/^\/api\/tmdb\/discover\/(movie|tv)$/)
  if (tmdbDiscover) {
    const type = tmdbDiscover[1] as 'movie' | 'tv'
    const requestPage = page(url)
    const sortBy = url.searchParams.get('sort_by') || undefined
    const sortOptions = new Set(['popularity.desc', 'popularity.asc', 'vote_average.desc', 'vote_average.asc', 'primary_release_date.desc', 'primary_release_date.asc', 'first_air_date.desc', 'first_air_date.asc', 'original_title.asc', 'original_title.desc'])
    const parsePositive = (value: string | null, max = Number.MAX_SAFE_INTEGER) => value === null ? undefined : /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0 && Number(value) <= max ? Number(value) : null
    const genreId = parsePositive(url.searchParams.get('with_genres'))
    const yearFrom = parsePositive(url.searchParams.get('year_from'), new Date().getFullYear() + 5)
    const yearTo = parsePositive(url.searchParams.get('year_to'), new Date().getFullYear() + 5)
    if (requestPage === null || genreId === null || yearFrom === null || yearTo === null || (yearFrom !== undefined && yearFrom < 1870) || (yearTo !== undefined && yearTo < 1870) || (yearFrom !== undefined && yearTo !== undefined && yearFrom > yearTo) || (sortBy !== undefined && !sortOptions.has(sortBy))) return json({ error: 'Invalid discover parameters' }, 400)
    try {
      return json(await tmdb.discover(type, {
        page: requestPage,
        sortBy,
        genreId,
        yearFrom,
        yearTo,
        language: language(url),
        region: region(url),
      }))
    } catch (err: any) {
      return json({ error: err.message }, 500)
    }
  }

  if (path === '/api/introdb/segments') {
    const imdbId = url.searchParams.get('imdb_id')
    const validPositive = (value: string | null, max: number) => value === null || (/^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0 && Number(value) <= max)
    const season = url.searchParams.get('season')
    const episode = url.searchParams.get('episode')
    if (!imdbId || !/^tt\d{7,10}$/.test(imdbId) || !validPositive(season, 999) || !validPositive(episode, 10_000)) return json({ error: 'Invalid IntroDB parameters' }, 400)
    const params = new URLSearchParams({ imdb_id: imdbId })
    for (const [key, value] of [['season', season], ['episode', episode]] as const) {
      if (value) params.set(key, value)
    }
    try {
      const upstream = await fetch(`https://api.introdb.app/segments?${params}`, { signal: AbortSignal.timeout(5000) })
      if (upstream.status === 404) return json([])
      return new Response(upstream.body, { status: upstream.status, headers: { 'Content-Type': upstream.headers.get('content-type') || 'application/json', 'Access-Control-Allow-Origin': '*' } })
    } catch {
      return json({ error: 'IntroDB proxy error' }, 502)
    }
  }

  // --- 404 ---
  return json({ error: 'Not found' }, 404)
}

/**
 * Resolve the Access-Control-Allow-Origin value for a request, matching the
 * Fastify server's @fastify/cors behavior in app.ts: CORS_ORIGIN='*' (the
 * default) allows any origin; a comma-separated list echoes the request's
 * Origin back only when it is in the list, and otherwise does not advertise
 * CORS access. CORS_ORIGIN is read from process.env, which Cloudflare populates
 * from Worker vars/secrets under nodejs_compat (compat date >= 2025-04-01).
 */
function resolveAllowOrigin(req: Request): string | null {
  const configured = process.env.CORS_ORIGIN || '*'
  if (configured === '*') return '*'
  const allowed = configured.split(',').map(o => o.trim()).filter(Boolean)
  const origin = req.headers.get('Origin')
  return origin && allowed.includes(origin) ? origin : null
}

/**
 * Apply the resolved CORS origin to every outgoing response at a single choke
 * point. The json()/cors() helpers and the proxy/introdb responses all bake in
 * a permissive default; this overrides it with the configured origin (or strips
 * it when the origin is not allowed).
 */
function applyCors(req: Request, res: Response): Response {
  const allow = resolveAllowOrigin(req)
  if (allow) res.headers.set('Access-Control-Allow-Origin', allow)
  else res.headers.delete('Access-Control-Allow-Origin')
  if ((process.env.CORS_ORIGIN || '*') !== '*') {
    const vary = res.headers.get('Vary')
    res.headers.set('Vary', vary ? `${vary}, Origin` : 'Origin')
  }
  return res
}

async function handleRequest(req: Request): Promise<Response> {
  // Last-resort catch: without it an unexpected throw (e.g. from a provider)
  // surfaces as a raw Workers 1101 exception page instead of a JSON 500, and
  // without CORS headers the UI can't even read the error.
  try {
    return applyCors(req, await route(req))
  } catch (err) {
    console.error('[Worker] Unhandled error:', err)
    return applyCors(req, json({ error: 'Internal server error' }, 500))
  }
}

export default {
  fetch: handleRequest,
}
