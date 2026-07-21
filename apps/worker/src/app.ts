import Fastify from "fastify"
import { env } from "./config/env"
import { db } from "./lib/db"
import { redisConnection } from "./lib/redis"

export function createApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      base: {
        service: "worker",
        environment: env.NODE_ENV,
      },
      transport:
        env.NODE_ENV === "development"
          ? { target: "pino-pretty", options: { colorize: true } }
          : undefined,
    },
  })

  app.get("/health/live", async () => ({ status: "ok" }))
  app.get("/health/ready", async (_request, reply) => {
    const checks = await Promise.allSettled([
      db.check(),
      redisConnection.ping(),
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
