import type { FastifyInstance } from 'fastify'
import { proxyRequest } from '../services/proxy.js'

/**
 * Proxy route — streams content from upstream providers.
 *
 * The data parameter is a base64-encoded JSON with { url, headers }.
 * This keeps the upstream URL hidden from the client and allows
 * the server to inject required headers (Referer, Origin, etc).
 */
export async function proxyRoutes(app: FastifyInstance) {
  app.get('/v1/proxy', async (request, reply) => {
    const { data } = request.query as { data?: string }
    if (!data) {
      return reply.code(400).send({ error: 'Missing data parameter' })
    }

    await proxyRequest(data, reply)
  })
}
