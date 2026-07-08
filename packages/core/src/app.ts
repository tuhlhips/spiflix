import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import { env } from './config/env.js'
import { loggerConfig } from './config/logger.js'
import { ProviderRegistry } from './providers/registry.js'
import { sourceRoutes } from './routes/sources.js'
import { proxyRoutes } from './routes/proxy.js'
import { tmdbRoutes } from './routes/tmdb.js'
import { healthRoutes } from './routes/health.js'

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
    trustProxy: true,
  })

  // --- Plugins ---

  await app.register(cors, {
    origin: env.cors.origin === '*' ? true : env.cors.origin.split(','),
    methods: ['GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
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

  return app
}
