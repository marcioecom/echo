import { describe, expect, it } from "vitest"

import type { ApiEnv } from "./config/env"
import { createApp } from "./app"

const env: ApiEnv = {
  DATABASE_URL: "postgres://localhost/test",
  REDIS_URL: "redis://localhost:6379",
  DEPENDENCY_TIMEOUT_MS: 5_000,
  API_HOST: "127.0.0.1",
  API_PORT: 3001,
  NODE_ENV: "test",
  LOG_LEVEL: "silent",
}

describe("API health", () => {
  it("separates liveness from dependency readiness", async () => {
    const app = createApp(env, {
      postgres: async () => undefined,
      redis: async () => {
        throw new Error("unavailable")
      },
    })

    const live = await app.inject({ method: "GET", url: "/health/live" })
    const ready = await app.inject({ method: "GET", url: "/health/ready" })

    expect(live.statusCode).toBe(200)
    expect(ready.statusCode).toBe(503)
    expect(ready.json()).toEqual({
      status: "unavailable",
      dependencies: { postgres: "ok", redis: "unavailable" },
    })

    await app.close()
  })
})
