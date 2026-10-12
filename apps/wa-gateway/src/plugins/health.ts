import type { FastifyInstance } from "fastify"

import { database } from "../lib/db"
import { pingRedis } from "../lib/redis"

export function registerHealthRoutes(app: FastifyInstance) {
  app.get("/healthz", { logLevel: "silent" }, async () => ({ status: "ok" }))

  app.get("/readyz", { logLevel: "silent" }, async (_request, reply) => {
    const checks = await Promise.allSettled([database.check(), pingRedis()])
    const [postgres, redis] = checks
    const body = {
      status: checks.every((check) => check.status === "fulfilled")
        ? "ok"
        : "unavailable",
      dependencies: {
        postgres: postgres?.status === "fulfilled" ? "ok" : "unavailable",
        redis: redis?.status === "fulfilled" ? "ok" : "unavailable",
      },
    }

    if (body.status !== "ok") {
      return reply.code(503).send(body)
    }

    return body
  })
}
