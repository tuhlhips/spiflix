import { createApp } from './app.js'
import { env } from './config/env.js'

/**
 * Server entry point — starts Fastify and handles graceful shutdown.
 */
async function main() {
  const app = await createApp()

  try {
    await app.listen({ port: env.port, host: env.host })
    console.log(`[Spiflix] Server running on http://${env.host}:${env.port}`)
    console.log(`[Spiflix] Environment: ${env.nodeEnv}`)
    console.log(`[Spiflix] Providers: ${app.registry.getAll().length} active`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n[Spiflix] ${signal} received, shutting down...`)
    await app.close()
    process.exit(0)
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

main().catch((err) => {
  // createApp() runs before the try/catch inside main() (e.g. a missing
  // required env var throws there). Without this handler that surfaces as a
  // raw unhandled promise rejection instead of a clean, logged exit.
  console.error('[Spiflix] Fatal startup error:', err)
  process.exit(1)
})
