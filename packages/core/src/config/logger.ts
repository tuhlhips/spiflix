import type { FastifyServerOptions } from 'fastify'

const isProduction = process.env.NODE_ENV === 'production'

/**
 * Logger configuration.
 *
 * In production the `pino-pretty` transport is omitted entirely. `pino-pretty`
 * is a devDependency, so it is not installed when `NODE_ENV=production` during
 * `pnpm install` — referencing it would crash Pino's worker-thread transport
 * loader at startup. Plain JSON to stdout is also the correct format for a
 * hosting platform's log aggregation, so this is the right default, not just a
 * workaround.
 */
export const loggerConfig: FastifyServerOptions['logger'] = {
  level: isProduction ? 'info' : 'debug',
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
      }),
}
