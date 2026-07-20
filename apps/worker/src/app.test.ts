import { describe, expect, it } from "vitest"

import type { WorkerEnv } from "./config/env"
import { createApp } from "./app"

const env: WorkerEnv = {
  DATABASE_URL: "postgres://localhost/test",
  REDIS_URL: "redis://localhost:6379",
  DEPENDENCY_TIMEOUT_MS: 5_000,
  WORKER_HOST: "127.0.0.1",
  WORKER_PORT: 3002,
  NODE_ENV: "test",
  LOG_LEVEL: "silent",
  RESEND_API_KEY: "re_test",
  EMAIL_FROM: "Echo <test@echo.dev>",
}

describe("worker health", () => {
  it("reports readiness only when every dependency is available", async () => {
    const app = createApp(env, {
      postgres: async () => undefined,
      redis: async () => undefined,
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
