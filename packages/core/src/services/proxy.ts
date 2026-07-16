import { createHmac, timingSafeEqual } from 'node:crypto'
import { env } from '../config/env.js'

interface ProxyData {
  url: string
  headers: Record<string, string>
  expiresAt: number
}

export interface ProxyRequestOptions {
  range?: string
  signature?: string
}

function sign(data: string, secret: string = env.proxy.signingSecret): string {
  return createHmac('sha256', secret).update(data).digest('base64url')
}

function isValidSignature(data: string, signature?: string): boolean {
  if (!signature) return false
  const actual = Buffer.from(signature)
  // Accept the current secret and any still-valid previous secret so a rotation
  // does not invalidate in-flight signed URLs. Every candidate is checked with
  // a constant-time comparison and the loop never early-exits, so timing does
  // not reveal which secret (if any) matched.
  let matched = false
  for (const secret of [env.proxy.signingSecret, ...env.proxy.previousSigningSecrets]) {
    const expected = Buffer.from(sign(data, secret))
    if (actual.length === expected.length && timingSafeEqual(actual, expected)) {
      matched = true
    }
  }
  return matched
}

function decodeProxyData(data: string): ProxyData {
  const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as ProxyData
  const url = new URL(parsed.url)
  if (!['http:', 'https:'].includes(url.protocol) || !parsed.headers || typeof parsed.headers !== 'object' || !Number.isSafeInteger(parsed.expiresAt)) {
    throw new Error('Invalid proxy payload')
  }
  if (parsed.expiresAt <= Date.now()) throw new Error('Expired proxy payload')
  if (env.proxy.allowedHosts.length > 0 && !env.proxy.allowedHosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) {
    throw new Error('Proxy host is not allowed')
  }
  return { url: url.toString(), headers: parsed.headers, expiresAt: parsed.expiresAt }
}

/** Build a tamper-proof proxy URL. Only server-created upstream URLs can be fetched. */
export function createProxyUrl(url: string, headers: Record<string, string> = {}, base = '', expiresAt = Date.now() + Math.max(60, env.proxy.tokenTtlSeconds) * 1000): string {
  const data = Buffer.from(JSON.stringify({ url, headers, expiresAt })).toString('base64url')
  return `${base}/v1/proxy?data=${data}&sig=${sign(data)}`
}

function makeHeaders(upstream: Response): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=3600',
    Vary: 'Range',
  }
  for (const [source, target] of Object.entries({
    'content-type': 'Content-Type',
    'content-length': 'Content-Length',
    'content-range': 'Content-Range',
    'accept-ranges': 'Accept-Ranges',
    etag: 'ETag',
    'last-modified': 'Last-Modified',
  })) {
    const value = upstream.headers.get(source)
    if (value) headers[target] = value
  }
  return headers
}

function isHls(url: string, response: Response): boolean {
  return url.includes('.m3u8') || response.headers.get('content-type')?.includes('mpegurl') === true
}

function rewriteHlsUri(value: string, baseUrl: string, headers: Record<string, string>, expiresAt: number): string {
  try {
    if (value.startsWith('data:')) return value
    return createProxyUrl(new URL(value, baseUrl).toString(), headers, '', expiresAt)
  } catch {
    return value
  }
}

/** Rewrite nested playlist/key/segment URLs so native HLS never escapes the proxy. */
function rewriteHlsManifest(manifest: string, baseUrl: string, headers: Record<string, string>, expiresAt: number): string {
  return manifest.split(/(\r?\n)/).map(line => {
    if (!line || /^\s*#EXTM3U/.test(line)) return line
    if (line.startsWith('#')) {
      return line.replace(/URI="([^"]+)"/g, (_match, uri: string) => `URI="${rewriteHlsUri(uri, baseUrl, headers, expiresAt)}"`)
    }
    return rewriteHlsUri(line.trim(), baseUrl, headers, expiresAt)
  }).join('')
}

/** Proxy a signed request and preserve byte-range semantics for native media players. */
export async function proxyRequest(data: string, { range, signature }: ProxyRequestOptions = {}): Promise<Response> {
  if (!isValidSignature(data, signature)) {
    return new Response(JSON.stringify({ error: 'Invalid proxy signature' }), { status: 403, headers: { 'Content-Type': 'application/json' } })
  }

  let payload: ProxyData
  try {
    payload = decodeProxyData(data)
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid proxy payload' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)
  try {
    const upstreamHeaders = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', ...payload.headers } as Record<string, string>
    if (range) upstreamHeaders.Range = range
    const upstream = await fetch(payload.url, { headers: upstreamHeaders, signal: controller.signal })
    if (!upstream.ok && upstream.status !== 416) {
      return new Response(JSON.stringify({ error: `Upstream returned ${upstream.status}` }), { status: upstream.status, headers: { 'Content-Type': 'application/json' } })
    }

    const headers = makeHeaders(upstream)
    if (isHls(payload.url, upstream) && upstream.body) {
      const manifest = rewriteHlsManifest(await upstream.text(), payload.url, payload.headers, payload.expiresAt)
      delete headers['Content-Length']
      headers['Cache-Control'] = 'no-store'
      return new Response(manifest, { status: upstream.status, headers })
    }
    return new Response(upstream.body, { status: upstream.status, headers })
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === 'AbortError'
    return new Response(JSON.stringify({ error: isTimeout ? 'Upstream timeout' : 'Upstream error' }), { status: isTimeout ? 504 : 502, headers: { 'Content-Type': 'application/json' } })
  } finally {
    clearTimeout(timeout)
  }
}
