import { CallbackManager } from "@langchain/core/callbacks/manager"
import { afterEach, expect, it, vi } from "vitest"

const requiredEnv = {
  DATABASE_URL: "postgres://localhost/echo",
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
  AI_GATEWAY_API_KEY: "test-key",
}

afterEach(() => vi.unstubAllEnvs())

it("traces only when LANGSMITH_TRACING is explicitly enabled", async () => {
  for (const [key, value] of Object.entries(requiredEnv)) vi.stubEnv(key, value)
  vi.stubEnv("LANGSMITH_API_KEY", "lsv2_test")
  vi.stubEnv("LANGSMITH_TRACING", "false")

  // Reload the config module to exercise both startup environments.
  const { env } = await import("./env")
  expect(env.LANGSMITH_TRACING).toBe("false")
  expect(CallbackManager.configure()?.handlers).toBeUndefined()

  vi.stubEnv("LANGSMITH_TRACING", "true")
  vi.resetModules()
  const enabled = await import("./env")
  expect(enabled.env.LANGSMITH_TRACING).toBe("true")
  expect(CallbackManager.configure()?.handlers.map((handler) => handler.name)).toContain(
    "langchain_tracer"
  )
})
