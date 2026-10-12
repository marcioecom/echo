import { Writable } from "node:stream"

import { describe, expect, it } from "vitest"

import { createBaileysLogger, redact } from "./baileys-logger"

describe("baileys logger", () => {
  it("redacts QR codes and drops info logs", () => {
    expect(
      redact({ qr: "2@secret", nested: { pairingCode: "ABCD1234" } })
    ).toEqual({
      qr: "[redacted]",
      nested: { pairingCode: "[redacted]" },
    })

    const lines: string[] = []
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        lines.push(chunk.toString())
        callback()
      },
    })
    const logger = createBaileysLogger(stream)
    logger.info({ qr: "2@info" }, "ignored")
    logger.warn({ qr: "2@secret" }, "connection update")

    const output = lines.join("")
    expect(output).not.toContain("2@secret")
    expect(output).not.toContain("2@info")
    expect(output).toContain("[redacted]")
  })
})
