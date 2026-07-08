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
