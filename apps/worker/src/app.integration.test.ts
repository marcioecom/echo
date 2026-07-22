import { PostgreSqlContainer } from "@testcontainers/postgresql"
import type { createDatabase } from "@workspace/db"
import type { Redis } from "ioredis"
import { GenericContainer } from "testcontainers"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import type { createApp } from "./app"

describe("worker readiness with real dependencies", () => {
  const postgresContainer = new PostgreSqlContainer("postgres:17-alpine")
  const redisContainer = new GenericContainer(
    "redis:7.4-alpine"
  ).withExposedPorts(6379)

  let app: ReturnType<typeof createApp>
  let database: ReturnType<typeof createDatabase>
  let redis: Redis
  let stopPostgres: () => Promise<void>
  let stopRedis: () => Promise<void>

  beforeAll(async () => {
    const [postgres, redisService] = await Promise.all([
      postgresContainer.start(),
      redisContainer.start(),
    ])
    stopPostgres = () => postgres.stop().then(() => undefined)
    stopRedis = () => redisService.stop().then(() => undefined)

    vi.stubEnv("DATABASE_URL", postgres.getConnectionUri())
    vi.stubEnv(
      "REDIS_URL",
      `redis://${redisService.getHost()}:${redisService.getMappedPort(6379)}`
    )
    vi.stubEnv("DEPENDENCY_TIMEOUT_MS", "10000")
    vi.stubEnv("WORKER_HOST", "127.0.0.1")
    vi.stubEnv("WORKER_PORT", "3002")
    vi.stubEnv("RESEND_API_KEY", "re_test")
    vi.stubEnv("EMAIL_FROM", "Echo <test@echo.dev>")
    vi.stubEnv("NODE_ENV", "test")
    vi.stubEnv("LOG_LEVEL", "silent")

    vi.resetModules()
    const [appModule, dbModule, redisModule] = await Promise.all([
      import("./app"),
      import("./lib/db"),
      import("./lib/redis"),
    ])
    app = appModule.createApp()
    database = dbModule.db
    redis = redisModule.redisConnection
  }, 60_000)

  afterAll(async () => {
    await Promise.allSettled([
      app?.close(),
      database?.close(),
      redis?.quit(),
      stopPostgres?.(),
      stopRedis?.(),
    ])
    vi.unstubAllEnvs()
  })

  it("reports Postgres and Redis as ready", async () => {
    const response = await app.inject({ method: "GET", url: "/health/ready" })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      status: "ok",
      dependencies: { postgres: "ok", redis: "ok" },
    })
  })
})
