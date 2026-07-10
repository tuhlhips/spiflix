import type { FastifyInstance } from 'fastify'

const INTRODB_BASE = 'https://api.introdb.app'

export async function introdbRoutes(app: FastifyInstance) {
  app.get('/api/introdb/segments', async (request, reply) => {
    const { imdb_id, season, episode } = request.query as {
      imdb_id?: string
      season?: string
      episode?: string
    }

    if (!imdb_id) {
      return reply.code(400).send({ error: 'Missing imdb_id' })
    }

    const params = new URLSearchParams({ imdb_id })
    if (season) params.set('season', season)
    if (episode) params.set('episode', episode)

    try {
      const res = await fetch(`${INTRODB_BASE}/segments?${params}`, {
        signal: AbortSignal.timeout(5000),
      })

      if (res.status === 404) {
        return reply.code(200).send([])
      }

      if (!res.ok) {
        return reply.code(res.status).send({ error: 'IntroDB upstream error' })
      }

      const data = await res.json()
      return reply.send(data)
    } catch (err: any) {
      request.log.error(err)
      return reply.code(502).send({ error: 'IntroDB proxy error' })
    }
  })
}
