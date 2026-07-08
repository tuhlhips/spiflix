import type { FastifyInstance } from 'fastify'
import { sourceCache, tmdbCache } from '../services/cache.js'
import { env } from '../config/env.js'

/**
 * Health routes — status, debug, and provider health checks.
 */
export async function healthRoutes(app: FastifyInstance) {
  const startTime = Date.now()

  /** GET /api/health — basic health check */
  app.get('/api/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
      uptime: Math.floor((Date.now() - startTime) / 1000),
    }
  })

  /** GET /api/debug — debug info (dev only) */
  app.get('/api/debug', async () => {
    if (!env.isDev) {
      return { error: 'Only available in development mode' }
    }

    return {
      env: env.nodeEnv,
      port: env.port,
      cache: {
        type: env.cache.type,
        sourceEntries: sourceCache.size,
        tmdbEntries: tmdbCache.size,
      },
      providers: app.registry.getAll().map(p => ({
        id: p.config.id,
        name: p.config.name,
        enabled: p.config.enabled,
      })),
    }
  })

  /** GET /api/health/providers — provider health checks */
  app.get('/api/health/providers', async () => {
    const checks = await app.registry.healthCheckAll()
    const healthy = checks.filter(c => c.healthy).length
    return {
      status: healthy === checks.length ? 'ok' : 'degraded',
      providers: checks,
    }
  })
}
