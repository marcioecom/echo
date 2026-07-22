import { beforeEach, describe, expect, it, vi } from "vitest"

const { postgres, redis } = vi.hoisted(() => ({
  postgres: vi.fn(),
  redis: vi.fn(),
}))

vi.mock("./lib/db", () => ({ db: { check: postgres } }))
vi.mock("./lib/redis", () => ({ pingRedis: redis }))

import { createApp } from "./app"

describe("worker health", () => {
  beforeEach(() => {
    postgres.mockReset()
    redis.mockReset()
  })

  it("reports readiness only when every dependency is available", async () => {
    postgres.mockResolvedValue(undefined)
    redis.mockResolvedValue(undefined)
    const app = createApp()

    const response = await app.inject({ method: "GET", url: "/health/ready" })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      status: "ok",
      dependencies: { postgres: "ok", redis: "ok" },
    })

    await app.close()
  })
})
