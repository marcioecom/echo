import type { FastifyInstance } from "fastify"

export interface HealthDependencies {
  postgres: () => Promise<void>
  redis: () => Promise<void>
}

export function registerHealthRoutes(
  app: FastifyInstance,
  dependencies: HealthDependencies,
): void {
  app.get("/health/live", async () => ({ status: "ok" }))

  app.get("/health/ready", async (_request, reply) => {
    const checks = await Promise.allSettled([
      dependencies.postgres(),
      dependencies.redis(),
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
}
