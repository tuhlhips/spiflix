import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import compress from '@fastify/compress'
import rateLimit from '@fastify/rate-limit'
import { env } from './config/env.js'
import { loggerConfig } from './config/logger.js'
import { ProviderRegistry } from './providers/registry.js'
import { sourceRoutes } from './routes/sources.js'
import { proxyRoutes } from './routes/proxy.js'
import { tmdbRoutes } from './routes/tmdb.js'
import { healthRoutes } from './routes/health.js'
import { introdbRoutes } from './routes/introdb.js'

/**
 * App factory — creates and configures the Fastify instance.
 *
 * Plugin-based architecture: each concern (CORS, rate limiting, routes)
 * is registered as a separate plugin. This keeps the setup composable
 * and testable.
 */
export async function createApp() {
  const app = Fastify({
    logger: loggerConfig,
    // Only trust explicitly configured reverse-proxy addresses. Trusting every
    // forwarded header lets direct clients bypass IP-based rate limiting.
    trustProxy: env.trustProxy.length > 0 ? env.trustProxy : false,
  })

  // --- Plugins ---

  // Security headers. crossOriginResourcePolicy is forced to 'cross-origin':
  // this API is meant to be fetched from the UI on a different origin (see
  // CORS_ORIGIN / @fastify/cors below), and helmet's default of 'same-origin'
  // would make browsers block every TMDB fetch and video stream. CSP/COOP/COEP
  // defaults are fine — this server never serves HTML documents for them to
  // constrain.
  await app.register(helmet, {
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })

  // Response compression for the JSON API routes. The /v1/proxy route opts out
  // via `{ compress: false }` (see routes/proxy.ts) so byte-range streaming is
  // never corrupted.
  await app.register(compress)

  await app.register(cors, {
    origin: env.cors.origin === '*' ? true : env.cors.origin.split(',').map(o => o.trim()).filter(Boolean),
    methods: ['GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Range'],
    exposedHeaders: ['Content-Range', 'Accept-Ranges', 'ETag', 'X-Cache'],
    maxAge: 86400,
  })

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 second',
  })

  // --- Registry ---

  const registry = new ProviderRegistry()
  await registry.discover()
  app.decorate('registry', registry)

  // --- Routes ---

  await app.register(sourceRoutes)
  await app.register(proxyRoutes)
  await app.register(tmdbRoutes)
  await app.register(healthRoutes)
  await app.register(introdbRoutes)

  return app
}
