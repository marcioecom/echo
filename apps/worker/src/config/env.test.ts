import { afterEach, describe, expect, it, vi } from "vitest"

const requiredEnv = {
  DATABASE_URL: "postgres://postgres:postgres@localhost:5432/echo",
  REDIS_URL: "redis://localhost:6379",
  RESEND_API_KEY: "re_test",
  EMAIL_FROM: "Echo <test@echo.dev>",
  PUBLIC_API_URL: "http://localhost:3001",
  CHANNEL_CREDENTIALS_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
  CHANNEL_CREDENTIALS_KEY_VERSION: "v1",
  R2_ENDPOINT: "https://r2.echo.test",
  R2_BUCKET_NAME: "echo-storage",
  R2_ACCESS_KEY_ID: "test-access-key",
  R2_SECRET_ACCESS_KEY: "test-secret-key",
  AI_GATEWAY_API_KEY: "test-gateway-key",
}

const tracingEnvKeys = [
  "LANGSMITH_TRACING",
  "LANGSMITH_API_KEY",
  "LANGSMITH_PROJECT",
  "LANGCHAIN_CALLBACKS_BACKGROUND",
] as const

describe("worker env LangSmith wiring", () => {
  const previous = Object.fromEntries(
    tracingEnvKeys.map((key) => [key, process.env[key]])
  )

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
    for (const key of tracingEnvKeys) {
      const value = previous[key]
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  function stubRequiredEnv(): void {
    for (const [key, value] of Object.entries(requiredEnv)) {
      vi.stubEnv(key, value)
    }
  }

  it("loads without an API key and keeps tracing off", async () => {
    stubRequiredEnv()
    vi.stubEnv("LANGSMITH_TRACING", "true")
    vi.stubEnv("LANGSMITH_API_KEY", "")
    vi.stubEnv("LANGSMITH_PROJECT", "")

    const { env } = await import("./env")

    expect(env.LANGSMITH_API_KEY).toBeUndefined()
    expect(env.LANGSMITH_PROJECT).toBe("echo")
    expect(process.env.LANGSMITH_TRACING).toBe("false")
    expect(process.env.LANGSMITH_API_KEY).toBeUndefined()
  })

  it("enables tracing when the API key is set", async () => {
    stubRequiredEnv()
    vi.stubEnv("LANGSMITH_API_KEY", "lsv2_test_key")
    vi.stubEnv("LANGSMITH_PROJECT", "echo-dev")

    const { env } = await import("./env")

    expect(env.LANGSMITH_API_KEY).toBe("lsv2_test_key")
    expect(env.LANGSMITH_PROJECT).toBe("echo-dev")
    expect(process.env.LANGSMITH_TRACING).toBe("true")
    expect(process.env.LANGSMITH_PROJECT).toBe("echo-dev")
  })
})
