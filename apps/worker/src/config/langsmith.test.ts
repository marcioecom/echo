import { afterEach, describe, expect, it } from "vitest"
import { z } from "zod"

import {
  configureLangSmithTracing,
  defaultLangSmithProject,
  langSmithEnvShape,
} from "./langsmith"

const langSmithEnvSchema = z.object(langSmithEnvShape)

const tracingEnvKeys = [
  "LANGSMITH_TRACING",
  "LANGSMITH_API_KEY",
  "LANGSMITH_PROJECT",
  "LANGCHAIN_CALLBACKS_BACKGROUND",
] as const

describe("configureLangSmithTracing", () => {
  const previous = Object.fromEntries(
    tracingEnvKeys.map((key) => [key, process.env[key]])
  )

  afterEach(() => {
    for (const key of tracingEnvKeys) {
      const value = previous[key]
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  it("turns tracing off when the API key is absent", () => {
    process.env.LANGSMITH_TRACING = "true"
    process.env.LANGSMITH_API_KEY = "lsv2_should_be_removed"

    configureLangSmithTracing({
      apiKey: undefined,
      project: defaultLangSmithProject,
    })

    expect(process.env.LANGSMITH_TRACING).toBe("false")
    expect(process.env.LANGSMITH_API_KEY).toBeUndefined()
  })

  it("turns tracing on when the API key is present", () => {
    const logs: unknown[][] = []
    const write = (...args: unknown[]) => {
      logs.push(args)
    }
    const consoleLog = console.log
    const consoleInfo = console.info
    const consoleError = console.error
    console.log = write
    console.info = write
    console.error = write

    try {
      configureLangSmithTracing({
        apiKey: "lsv2_test_key",
        project: "echo-dev",
      })
    } finally {
      console.log = consoleLog
      console.info = consoleInfo
      console.error = consoleError
    }

    expect(process.env.LANGSMITH_TRACING).toBe("true")
    expect(process.env.LANGSMITH_API_KEY).toBe("lsv2_test_key")
    expect(process.env.LANGSMITH_PROJECT).toBe("echo-dev")
    expect(process.env.LANGCHAIN_CALLBACKS_BACKGROUND).toBe("true")
    expect(JSON.stringify(logs)).not.toContain("lsv2_test_key")
  })
})

describe("langSmith env", () => {
  it("treats a blank API key as unset and defaults the project", () => {
    expect(
      langSmithEnvSchema.parse({
        LANGSMITH_API_KEY: "  ",
        LANGSMITH_PROJECT: "",
      })
    ).toEqual({
      LANGSMITH_PROJECT: defaultLangSmithProject,
    })
  })

  it("keeps a trimmed project name", () => {
    expect(
      langSmithEnvSchema.parse({
        LANGSMITH_API_KEY: " lsv2_test_key ",
        LANGSMITH_PROJECT: " echo-dev ",
      })
    ).toEqual({
      LANGSMITH_API_KEY: "lsv2_test_key",
      LANGSMITH_PROJECT: "echo-dev",
    })
  })
})
