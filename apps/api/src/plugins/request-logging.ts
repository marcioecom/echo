import type { FastifyInstance, FastifyRequest } from "fastify"

export function registerRequestLogging(
  app: FastifyInstance,
  isDevelopment: boolean
): void {
  const errors = new WeakMap<FastifyRequest, Error>()

  app.addHook("onError", async (request, _reply, error) => {
    errors.set(request, error)
  })

  app.addHook("onResponse", async (request, reply) => {
    const statusCode = reply.statusCode
    const level =
      statusCode >= 500
        ? "error"
        : statusCode >= 400
          ? "warn"
          : isDevelopment
            ? "debug"
            : "info"

    request.log[level](
      {
        method: request.method,
        url: request.url.split("?", 1)[0],
        statusCode,
        responseTime: Math.round(reply.elapsedTime * 10) / 10,
        err: errors.get(request),
      },
      "request completed"
    )
  })
}
