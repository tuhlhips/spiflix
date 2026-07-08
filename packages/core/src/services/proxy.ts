import type { FastifyReply } from 'fastify'

/**
 * Streaming proxy — forwards requests to upstream providers.
 *
 * Design: Two modes — buffered (for small files like manifests)
 * and streaming (for video segments). The mode is chosen based
 * on the URL pattern to avoid buffering large video chunks in memory.
 *
 * Key insight from the reference: .ts/.m4s segments MUST be streamed.
 * Buffering them causes OOM on low-memory deployments.
 */

/** URL patterns that should be streamed, not buffered */
const STREAM_PATTERNS = [
  /\.ts(\?.*)?$/,
  /\.m4s(\?.*)?$/,
  /\.key(\?.*)?$/,
  /\.mp4(\?.*)?$/,
  /\.mkv(\?.*)?$/,
  /\.webm(\?.*)?$/,
  /hakunaymatata\.com/,
  /wasabisys\.com/,
  /tiktokcdn\.com/,
]

function shouldStream(url: string): boolean {
  return STREAM_PATTERNS.some(p => p.test(url))
}

interface ProxyData {
  url: string
  headers: Record<string, string>
}

/** Decode the proxy data parameter */
function decodeProxyData(encoded: string): ProxyData {
  try {
    return JSON.parse(decodeURIComponent(encoded))
  } catch {
    throw new Error('Invalid proxy data parameter')
  }
}

/** Proxy a request to an upstream URL */
export async function proxyRequest(
  encodedData: string,
  reply: FastifyReply,
): Promise<void> {
  const { url, headers } = decodeProxyData(encodedData)

  if (shouldStream(url)) {
    await handleStreaming(url, headers, reply)
  } else {
    await handleBuffered(url, headers, reply)
  }
}

/** Stream the upstream response directly (no buffering) */
async function handleStreaming(
  url: string,
  headers: Record<string, string>,
  reply: FastifyReply,
): Promise<void> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)

  try {
    const upstream = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ...headers,
      },
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!upstream.ok) {
      reply.code(upstream.status)
      reply.send({ error: `Upstream returned ${upstream.status}` })
      return
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream'

    reply.code(upstream.status)
    reply.header('Content-Type', contentType)
    reply.header('Access-Control-Allow-Origin', '*')
    reply.header('Cache-Control', 'public, max-age=3600')

    if (upstream.body) {
      const nodeStream = Readable.fromWeb(upstream.body as any)
      reply.send(nodeStream)
    } else {
      reply.send()
    }
  } catch (err: any) {
    clearTimeout(timeout)
    if (err.name === 'AbortError') {
      reply.code(504)
      reply.send({ error: 'Upstream timeout' })
    } else {
      reply.code(502)
      reply.send({ error: 'Upstream error' })
    }
  }
}

/** Buffer the entire upstream response (for small files) */
async function handleBuffered(
  url: string,
  headers: Record<string, string>,
  reply: FastifyReply,
): Promise<void> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)

  try {
    const upstream = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ...headers,
      },
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!upstream.ok) {
      reply.code(upstream.status)
      reply.send({ error: `Upstream returned ${upstream.status}` })
      return
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
    const body = Buffer.from(await upstream.arrayBuffer())

    reply.code(upstream.status)
    reply.header('Content-Type', contentType)
    reply.header('Content-Length', body.length)
    reply.header('Access-Control-Allow-Origin', '*')
    reply.header('Cache-Control', 'public, max-age=3600')
    reply.send(body)
  } catch (err: any) {
    clearTimeout(timeout)
    if (err.name === 'AbortError') {
      reply.code(504)
      reply.send({ error: 'Upstream timeout' })
    } else {
      reply.code(502)
      reply.send({ error: 'Upstream error' })
    }
  }
}

import { Readable } from 'node:stream'
