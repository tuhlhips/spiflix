import { createHmac, timingSafeEqual } from 'node:crypto'
import { isIP } from 'node:net'
import { lookup } from 'node:dns/promises'
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

/**
 * SSRF guard. Every upstream URL is HMAC-signed by us, but a malicious or
 * compromised provider could still hand us a stream URL pointing at an internal
 * address. We resolve the host and refuse to proxy anything that lands on
 * loopback, private, link-local (incl. the 169.254.169.254 metadata IP), CGNAT,
 * or reserved ranges. Public hosts — including the providers' rotating CDNs —
 * pass, which is why a static host allowlist is no longer required.
 *
 * Residual: DNS rebinding between this lookup and fetch's own resolution is not
 * pinned out; that's an advanced, low-likelihood attack against a personal
 * instance and is accepted here.
 */
function isPrivateIp(addr: string): boolean {
  let ip = addr
  const mapped = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i)
  if (mapped) ip = mapped[1]

  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number)
    if (a === 0 || a === 10 || a === 127) return true            // this-network, private, loopback
    if (a === 169 && b === 254) return true                      // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true             // private
    if (a === 192 && b === 168) return true                      // private
    if (a === 192 && b === 0) return true                        // IETF protocol assignments
    if (a === 100 && b >= 64 && b <= 127) return true            // CGNAT
    if (a === 198 && (b === 18 || b === 19)) return true         // benchmarking
    if (a >= 224) return true                                    // multicast + reserved
    return false
  }

  const v6 = ip.toLowerCase()
  if (v6 === '::1' || v6 === '::') return true                   // loopback / unspecified
  if (/^fe[89ab]/.test(v6)) return true                         // fe80::/10 link-local
  if (/^f[cd]/.test(v6)) return true                            // fc00::/7 unique-local
  return false
}

const hostDecisionCache = new Map<string, { blocked: boolean; at: number }>()
const HOST_CACHE_TTL = 5 * 60_000

/** Reject upstream hosts that resolve to a non-public address. */
async function assertPublicHost(rawUrl: string): Promise<void> {
  const host = new URL(rawUrl).hostname
  const cached = hostDecisionCache.get(host)
  if (cached && Date.now() - cached.at < HOST_CACHE_TTL) {
    if (cached.blocked) throw new Error('Blocked non-public host')
    return
  }

  const decide = async (): Promise<boolean> => {
    const bare = host.replace(/^\[|\]$/g, '')
    if (isIP(bare)) return isPrivateIp(bare)
    const lowered = host.toLowerCase()
    if (lowered === 'localhost' || lowered.endsWith('.localhost') || lowered.endsWith('.local') || lowered.endsWith('.internal')) return true
    const addrs = await lookup(host, { all: true })
    return addrs.length === 0 || addrs.some(a => isPrivateIp(a.address))
  }

  let blocked: boolean
  try {
    blocked = await decide()
  } catch {
    blocked = true // unresolvable / DNS failure → refuse
  }
  // Opportunistic eviction so rotating CDN hostnames can't grow the map forever.
  if (hostDecisionCache.size > 1_000) {
    const now = Date.now()
    for (const [key, entry] of hostDecisionCache) {
      if (now - entry.at >= HOST_CACHE_TTL) hostDecisionCache.delete(key)
    }
  }
  hostDecisionCache.set(host, { blocked, at: Date.now() })
  if (blocked) throw new Error('Blocked non-public host')
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
    // The split keeps the newline separators as array entries — they (and
    // whitespace-only lines) must pass through untouched: new URL('', base)
    // resolves to the base URL itself, so rewriting them would inject a
    // proxied copy of the master URL where every line break used to be.
    if (!line || line.trim() === '' || /^\s*#EXTM3U/.test(line)) return line
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

  try {
    await assertPublicHost(payload.url)
  } catch {
    return new Response(JSON.stringify({ error: 'Blocked host' }), { status: 403, headers: { 'Content-Type': 'application/json' } })
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
    // Base for resolving relative manifest URLs: the FINAL URL after redirects.
    // Some CDNs (e.g. kriss424did) 302 the master to a rotating edge host and
    // list relative variant paths — resolving those against the pre-redirect
    // URL pointed nested requests at the wrong host and broke playback.
    const finalUrl = upstream.url || payload.url

    let manifest: string | null = null
    if ((isHls(payload.url, upstream) || finalUrl.includes('.m3u8')) && upstream.body) {
      manifest = await upstream.text()
    } else if (upstream.body && /^text\/(html|plain)/i.test(upstream.headers.get('content-type') ?? '')) {
      // Some hosts serve manifests with a text/html content-type and no .m3u8
      // anywhere in the URL (kriss424did again). Sniff the body — text
      // responses are small and never video, so reading fully is safe.
      const text = await upstream.text()
      if (text.trimStart().startsWith('#EXTM3U')) {
        manifest = text
      } else {
        delete headers['Content-Length'] // body was decoded; upstream length may not match
        return new Response(text, { status: upstream.status, headers })
      }
    }

    if (manifest !== null) {
      const rewritten = rewriteHlsManifest(manifest, finalUrl, payload.headers, payload.expiresAt)
      delete headers['Content-Length']
      headers['Cache-Control'] = 'no-store'
      return new Response(rewritten, { status: upstream.status, headers })
    }
    return new Response(upstream.body, { status: upstream.status, headers })
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === 'AbortError'
    return new Response(JSON.stringify({ error: isTimeout ? 'Upstream timeout' : 'Upstream error' }), { status: isTimeout ? 504 : 502, headers: { 'Content-Type': 'application/json' } })
  } finally {
    clearTimeout(timeout)
  }
}
