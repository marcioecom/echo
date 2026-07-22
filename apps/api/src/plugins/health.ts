import type { FastifyInstance } from "fastify"
import { pingRedis } from "../lib/redis"
import { database } from "../lib/db"

export function registerHealthRoutes(app: FastifyInstance) {
  app.get("/health/live", async () => ({ status: "ok" }))

  app.get("/health/ready", async (_request, reply) => {
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
