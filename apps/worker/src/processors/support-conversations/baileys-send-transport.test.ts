import { beforeEach, describe, expect, it, vi } from "vitest"

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

import { createBaileysSendTransport } from "./baileys-send-transport"

const command = {
  organizationId: "01K1EDN69NFBWCG42B2H99V2C1",
  channelConnectionId: "01K1EDN9C8VT0N8WRM13RM6M55",
  outboundMessageId: "01K1EDN69NFBWCG42B2H99V2C5",
  to: "+5511888888888",
  body: "Olá",
}

const connectionQueue = `wa-gateway-${command.channelConnectionId}`

describe("createBaileysSendTransport", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    add.mockResolvedValue({ waitUntilFinished })
    close.mockResolvedValue(undefined)
  })

  it("waits for the gateway send result on the connection queue", async () => {
    waitUntilFinished.mockResolvedValue({
      ok: true,
      externalMessageId: "BAILEYS1",
    })
    const transport = createBaileysSendTransport({} as never)

    await expect(transport.send(command)).resolves.toEqual({
      ok: true,
      externalMessageId: "BAILEYS1",
    })
    expect(constructQueue).toHaveBeenCalledWith(connectionQueue, {
      connection: {},
    })
    expect(constructEvents).toHaveBeenCalledWith(connectionQueue, {
      connection: {},
    })
    expect(add).toHaveBeenCalledWith(
      "wa-send",
      command,
      expect.objectContaining({ attempts: 1 })
    )
    const options = add.mock.calls[0]?.[2] as { jobId: string }
    expect(
      options.jobId.startsWith(`wa-send--${command.outboundMessageId}--`)
    ).toBe(true)
    expect(close).toHaveBeenCalledTimes(2)
  })

  it("returns a retryable failure when the gateway does not answer", async () => {
    waitUntilFinished.mockRejectedValue(new Error("timeout"))
    const transport = createBaileysSendTransport({} as never)

    await expect(transport.send(command)).resolves.toEqual({
      ok: false,
      retryable: true,
      code: "gateway_unavailable",
    })
    expect(close).toHaveBeenCalledTimes(2)
  })
})
