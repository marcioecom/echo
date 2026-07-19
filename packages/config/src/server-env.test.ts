import { describe, expect, it } from "vitest"

import { loadEnv, serverEnvSchema } from "./server-env"

describe("loadEnv", () => {
  it("parses the shared server environment", () => {
    expect(
      loadEnv(serverEnvSchema, {
        DATABASE_URL: "postgres://postgres:postgres@localhost:5432/echo",
        REDIS_URL: "redis://localhost:6379",
      }),
    ).toMatchObject({
      DEPENDENCY_TIMEOUT_MS: 5_000,
      NODE_ENV: "development",
      LOG_LEVEL: "info",
    })
  })

  it("fails with readable validation errors", () => {
    expect(() => loadEnv(serverEnvSchema, {})).toThrow("DATABASE_URL")
  })
})
