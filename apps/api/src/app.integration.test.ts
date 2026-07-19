import { resolve } from "node:path"

import { PostgreSqlContainer } from "@testcontainers/postgresql"
import { createDatabase } from "@workspace/db"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { GenericContainer } from "testcontainers"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import type { ApiEnv } from "./config/env"
import { createRedis } from "./lib/redis"
import { createApp } from "./app"

describe("API readiness with real dependencies", () => {
  const postgresContainer = new PostgreSqlContainer("postgres:17-alpine")
  const redisContainer = new GenericContainer("redis:7.4-alpine").withExposedPorts(
    6379,
  )

  let database: ReturnType<typeof createDatabase>
  let redis: ReturnType<typeof createRedis>
  let stopPostgres: () => Promise<void>
  let stopRedis: () => Promise<void>

  beforeAll(async () => {
    const [postgres, redisService] = await Promise.all([
      postgresContainer.start(),
      redisContainer.start(),
    ])
    stopPostgres = () => postgres.stop().then(() => undefined)
    stopRedis = () => redisService.stop().then(() => undefined)

    database = createDatabase(postgres.getConnectionUri(), 10_000)
    await migrate(database.db, {
      migrationsFolder: resolve(process.cwd(), "../../packages/db/migrations"),
    })

    redis = createRedis(
      `redis://${redisService.getHost()}:${redisService.getMappedPort(6379)}`,
      10_000,
    )
    await redis.connect()
  }, 60_000)

  afterAll(async () => {
    await Promise.allSettled([
      database?.close(),
      redis?.quit(),
      stopPostgres?.(),
      stopRedis?.(),
    ])
  })

  it("reports Postgres and Redis as ready", async () => {
    const env: ApiEnv = {
      DATABASE_URL: "postgres://unused",
      REDIS_URL: "redis://unused",
      DEPENDENCY_TIMEOUT_MS: 10_000,
      API_HOST: "127.0.0.1",
      API_PORT: 3001,
      NODE_ENV: "test",
      LOG_LEVEL: "silent",
    }
    const app = createApp(env, {
      postgres: () => database.check(),
      redis: async () => {
        await redis.ping()
      },
    })

    const response = await app.inject({ method: "GET", url: "/health/ready" })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      status: "ok",
      dependencies: { postgres: "ok", redis: "ok" },
    })

    await app.close()
  })
})
