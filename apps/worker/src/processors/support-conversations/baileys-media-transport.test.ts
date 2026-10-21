import { beforeEach, describe, expect, it, vi } from "vitest"

import { createBaileysMediaTransport } from "./baileys-media-transport"

const { add, close, waitUntilFinished, constructQueue, constructEvents } =
  vi.hoisted(() => ({
    add: vi.fn(),
    close: vi.fn(),
    waitUntilFinished: vi.fn(),
    constructQueue: vi.fn(),
    constructEvents: vi.fn(),
  }))

vi.mock("bullmq", () => ({
  Queue: class {
    constructor(name: string, options: unknown) {
      constructQueue(name, options)
    }

    add = add
    close = close
  },
  QueueEvents: class {
    constructor(name: string, options: unknown) {
      constructEvents(name, options)
    }

    close = close
  },
}))

const command = {
  organizationId: "01K1EDN69NFBWCG42B2H99V2C1",
  channelConnectionId: "01K1EDN9C8VT0N8WRM13RM6M55",
  externalMessageId: "BAILEYS-AUDIO-1",
  senderAddress: "+5511888888888",
}

const connectionQueue = `wa-gateway-${command.channelConnectionId}`

describe("createBaileysMediaTransport", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    add.mockResolvedValue({ waitUntilFinished })
    close.mockResolvedValue(undefined)
  })

  it("waits for the gateway media result on the connection queue", async () => {
    waitUntilFinished.mockResolvedValue({
      ok: true,
      media: {
        objectKey:
          "organizations/01K1EDN69NFBWCG42B2H99V2C1/channels/01K1EDN9C8VT0N8WRM13RM6M55/inbound/BAILEYS-AUDIO-1.ogg",
        mimeType: "audio/ogg",
        sizeBytes: 2048,
        durationMs: 4200,
      },
    })
    const transport = createBaileysMediaTransport({} as never)

    await expect(transport.fetchMedia(command)).resolves.toEqual({
      ok: true,
      media: {
        objectKey:
          "organizations/01K1EDN69NFBWCG42B2H99V2C1/channels/01K1EDN9C8VT0N8WRM13RM6M55/inbound/BAILEYS-AUDIO-1.ogg",
        mimeType: "audio/ogg",
        sizeBytes: 2048,
        durationMs: 4200,
      },
    })
    expect(constructQueue).toHaveBeenCalledWith(connectionQueue, {
      connection: {},
    })
    expect(constructEvents).toHaveBeenCalledWith(connectionQueue, {
      connection: {},
    })
    expect(add).toHaveBeenCalledWith(
      "wa-media",
      command,
      expect.objectContaining({ attempts: 1 })
    )
    const options = add.mock.calls[0]?.[2] as { jobId: string }
    expect(
      options.jobId.startsWith(`wa-media--${command.externalMessageId}--`)
    ).toBe(true)
    expect(close).toHaveBeenCalledTimes(2)
  })

  it("returns a retryable failure when the gateway does not answer", async () => {
    waitUntilFinished.mockRejectedValue(new Error("timeout"))
    const transport = createBaileysMediaTransport({} as never)

    await expect(transport.fetchMedia(command)).resolves.toEqual({
      ok: false,
      retryable: true,
      code: "gateway_unavailable",
    })
    expect(close).toHaveBeenCalledTimes(2)
  })

  it("returns a retryable failure when the gateway result is malformed", async () => {
    waitUntilFinished.mockResolvedValue({ mimeType: "audio/ogg" })
    const transport = createBaileysMediaTransport({} as never)

    await expect(transport.fetchMedia(command)).resolves.toEqual({
      ok: false,
      retryable: true,
      code: "gateway_unavailable",
    })
  })

  it("passes through a gateway download failure", async () => {
    waitUntilFinished.mockResolvedValue({
      ok: false,
      retryable: false,
      code: "unsupported_media",
    })
    const transport = createBaileysMediaTransport({} as never)

    await expect(transport.fetchMedia(command)).resolves.toEqual({
      ok: false,
      retryable: false,
      code: "unsupported_media",
    })
  })
})
