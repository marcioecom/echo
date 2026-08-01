import { beforeEach, describe, expect, it, vi } from "vitest"

const { enqueue, persistInboundMessage } = vi.hoisted(() => ({
  enqueue: vi.fn(),
  persistInboundMessage: vi.fn(),
}))

vi.mock("../../../lib/jobs-client", () => ({ jobs: { enqueue } }))
vi.mock("../repositories/inbound-message-repository", () => ({
  persistInboundMessage,
}))

import {
  ingestInboundMessage,
  InboundMessageEnqueueError,
} from "./ingest-inbound-message"

const input = {
  organizationId: "01K1EDN69NFBWCG42B2H99V2C1",
  channelConnectionId: "01K1EDN9C8VT0N8WRM13RM6M55",
  channelType: "whatsapp" as const,
  senderAddress: "+5511999999999",
  externalMessageId: "SM11111111111111111111111111111111",
  content: { type: "text" as const, body: "Help" },
  receivedAt: new Date("2026-07-30T12:00:00.000Z"),
}
const ingested = {
  organizationId: input.organizationId,
  contactId: "01K1EDN69NFBWCG42B2H99V2C2",
  channelIdentityId: "01K1EDN69NFBWCG42B2H99V2C3",
  supportConversationId: "01K1EDN69NFBWCG42B2H99V2C4",
  messageId: "01K1EDN69NFBWCG42B2H99V2C5",
  duplicate: false,
}

describe("ingestInboundMessage", () => {
  beforeEach(() => {
    enqueue.mockReset()
    persistInboundMessage.mockReset()
  })

  it("publishes an IDs-only job after persistence", async () => {
    persistInboundMessage.mockResolvedValue(ingested)
    enqueue.mockResolvedValue({ id: "job-id" })

    await expect(ingestInboundMessage(input)).resolves.toEqual({
      ...ingested,
      jobId: "job-id",
    })
    expect(enqueue).toHaveBeenCalledWith("process-inbound-message", {
      organizationId: ingested.organizationId,
      channelIdentityId: ingested.channelIdentityId,
      supportConversationId: ingested.supportConversationId,
      messageId: ingested.messageId,
    })
  })

  it("preserves committed IDs when enqueue fails", async () => {
    persistInboundMessage.mockResolvedValue(ingested)
    enqueue.mockRejectedValue(new Error("Redis unavailable"))

    const error = await ingestInboundMessage(input).catch((caught) => caught)
    expect(error).toBeInstanceOf(InboundMessageEnqueueError)
    expect(error.ingested).toEqual(ingested)
  })
})
