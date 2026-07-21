import { Writable } from "node:stream"
import pino from "pino"
import { describe, expect, it } from "vitest"
import { createLoggerAdapter } from "./adapter"

function createCapturedLogger() {
  const entries: Record<string, unknown>[] = []
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      entries.push(JSON.parse(chunk.toString()))
      callback()
    },
  })

  return { entries, logger: pino(destination) }
}

describe("createLoggerAdapter", () => {
  it("forwards message-first calls using Pino's native argument order", () => {
    const { entries, logger } = createCapturedLogger()

    createLoggerAdapter(logger).info("Job completed", { jobId: "job_123" })

    expect(entries).toContainEqual(
      expect.objectContaining({ msg: "Job completed", jobId: "job_123" }),
    )
  })

  it("preserves native Pino object-first calls", () => {
    const { entries, logger } = createCapturedLogger()

    createLoggerAdapter(logger).info({ requestId: "req_123" }, "Request received")

    expect(entries).toContainEqual(
      expect.objectContaining({ msg: "Request received", requestId: "req_123" }),
    )
  })

  it("adapts child loggers while preserving Pino bindings", () => {
    const { entries, logger } = createCapturedLogger()

    createLoggerAdapter(logger).child({ context: "worker:registry" }).info(
      "Registered processors",
      { processors: ["send-invitation-email"] },
    )

    expect(entries).toContainEqual(
      expect.objectContaining({
        context: "worker:registry",
        msg: "Registered processors",
        processors: ["send-invitation-email"],
      }),
    )
  })
})
