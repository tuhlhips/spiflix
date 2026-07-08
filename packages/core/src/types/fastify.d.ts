import type { ProviderRegistry } from '../providers/registry.js'

declare module 'fastify' {
  interface FastifyInstance {
    registry: ProviderRegistry
  }
}
