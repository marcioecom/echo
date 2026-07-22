import Fastify from "fastify"
import { db } from "./lib/db"
import { pingRedis } from "./lib/redis"
import { createLoggerWithContext } from "@workspace/logger"

export function createApp() {
  const logger = createLoggerWithContext("worker:api")
  const app = Fastify({
    loggerInstance: logger,
  })

  app.get("/health/live", async () => ({ status: "ok" }))
  app.get("/health/ready", async (_request, reply) => {
    const checks = await Promise.allSettled([
      db.check(),
      pingRedis(),
    ])
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

  return app
}
