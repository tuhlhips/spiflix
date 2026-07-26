import { config } from 'dotenv'
import { resolve } from 'node:path'

// Load .env from packages/core/.env (CWD when running from there)
config({ path: resolve(process.cwd(), '.env') })

function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) throw new Error(`Missing required env: ${key}`)
  return value
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] || fallback
}

export const env = {
  port: Number(optionalEnv('PORT', '3000')),
  host: optionalEnv('HOST', 'localhost'),
  nodeEnv: optionalEnv('NODE_ENV', 'development'),
  get isDev() { return this.nodeEnv === 'development' },
  get isProd() { return this.nodeEnv === 'production' },

  tmdb: {
    apiKey: requireEnv('TMDB_API_KEY'),
    cacheTtl: Number(optionalEnv('TMDB_CACHE_TTL', '86400')),
    baseUrl: 'https://api.themoviedb.org/3',
    imageBaseUrl: 'https://image.tmdb.org/t/p',
  },

  proxy: {
    // Keep proxy capabilities separate from the TMDB credential. Rotating one
    // secret must not affect the other service.
    signingSecret: requireEnv('PROXY_SIGNING_SECRET'),
    // Previous signing secrets, still accepted for *verification* only (never
    // for signing new URLs). Set this to the old secret during a rotation so
    // in-flight signed URLs — valid up to tokenTtlSeconds — keep working, then
    // clear it once that window has elapsed. Comma-separated to allow more than
    // one overlapping rotation. Normally empty.
    previousSigningSecrets: optionalEnv('PROXY_SIGNING_SECRET_PREVIOUS', '').split(',').map(value => value.trim()).filter(Boolean),
    // Optional now that the proxy has an SSRF guard (blocks internal addresses
    // at request time). When set, it's an additional allowlist on top; when
    // blank, any public host is proxied. See services/proxy.ts.
    allowedHosts: optionalEnv('PROXY_ALLOWED_HOSTS', '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean),
    tokenTtlSeconds: Number(optionalEnv('PROXY_TOKEN_TTL_SECONDS', '14400')),
  },

  trustProxy: optionalEnv('TRUST_PROXY', '').split(',').map(value => value.trim()).filter(Boolean),

  cache: {
    type: optionalEnv('CACHE_TYPE', 'memory') as 'memory' | 'redis',
    sourceTtl: Number(optionalEnv('SOURCE_CACHE_TTL', '3600')),
    subtitleTtl: Number(optionalEnv('SUBTITLE_CACHE_TTL', '86400')),
  },

  cors: {
    origin: optionalEnv('CORS_ORIGIN', '*'),
  },

  publicUrl: optionalEnv('PUBLIC_URL', ''),
} as const
