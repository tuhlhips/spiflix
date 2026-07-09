/**
 * Streaming proxy — forwards requests to upstream providers.
 * Platform-agnostic: returns Response objects (works on both
 * Fastify and Cloudflare Workers).
 */

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

function decodeProxyData(encoded: string): ProxyData {
  return JSON.parse(decodeURIComponent(encoded))
}

function makeHeaders(upstream: Response, extra: Record<string, string> = {}): Record<string, string> {
  const h: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=3600',
    ...extra,
  }
  const ct = upstream.headers.get('content-type')
  if (ct) h['Content-Type'] = ct
  return h
}

/** Proxy a request — returns a Response object */
export async function proxyRequest(encodedData: string): Promise<Response> {
  const { url, headers } = decodeProxyData(encodedData)

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
      return new Response(JSON.stringify({ error: `Upstream returned ${upstream.status}` }), {
        status: upstream.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Workers: stream body directly (no buffering needed)
    return new Response(upstream.body, {
      status: upstream.status,
      headers: makeHeaders(upstream),
    })
  } catch (err: any) {
    clearTimeout(timeout)
    const status = err.name === 'AbortError' ? 504 : 502
    const message = err.name === 'AbortError' ? 'Upstream timeout' : 'Upstream error'
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
