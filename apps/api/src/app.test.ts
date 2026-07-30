import { beforeEach, describe, expect, it, vi } from "vitest"

const { postgres, redis } = vi.hoisted(() => ({
  postgres: vi.fn(),
  redis: vi.fn(),
}))

vi.mock("./config/env", () => ({
  env: {
    LOG_LEVEL: "silent",
    NODE_ENV: "test",
    CHANNEL_CREDENTIALS_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
    CHANNEL_CREDENTIALS_KEY_VERSION: "v1",
    PUBLIC_API_URL: "http://localhost:3001",
    WEB_APP_URL: "http://localhost:3000",
  },
}))
vi.mock("./lib/db", () => ({ database: { check: postgres, db: {} } }))
vi.mock("./lib/redis", () => ({ pingRedis: redis }))
vi.mock("./modules/auth/auth", () => ({ auth: {} }))

import { createApp } from "./app"

describe("API health", () => {
  beforeEach(() => {
    postgres.mockReset()
    redis.mockReset()
  })

  it("separates liveness from dependency readiness", async () => {
    postgres.mockResolvedValue(undefined)
    redis.mockRejectedValue(new Error("unavailable"))
    const app = createApp()

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
