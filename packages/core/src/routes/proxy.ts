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
  // compress:false — this route streams video/HLS segments, including 206
  // Partial Content byte-range responses for seeking. Compressing a range
  // response corrupts byte offsets and breaks seeking, so global compression
  // (registered in app.ts) must never touch it.
  app.get('/v1/proxy', { compress: false }, async (request, reply) => {
    const { data, sig } = request.query as { data?: string; sig?: string }
    if (!data) {
      return reply.code(400).send({ error: 'Missing data parameter' })
    }

    const range = request.headers.range
    const resp = await proxyRequest(data, { range, signature: sig })
    reply.code(resp.status)
    resp.headers.forEach((v, k) => reply.header(k, v))
    return resp.body ? reply.send(resp.body) : reply.send()
  })
}
