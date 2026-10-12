import { beforeEach, describe, expect, it, vi } from "vitest"

const { applyDeliveryStatus, ingestInboundMessage, publish } = vi.hoisted(
  () => ({
    applyDeliveryStatus: vi.fn(),
    ingestInboundMessage: vi.fn(),
    publish: vi.fn(),
  })
)

vi.mock("../repositories/outbound-message-repository", () => ({
  outboundMessageRepository: { applyDeliveryStatus },
}))
vi.mock("../use-cases/ingest-inbound-message", () => ({
  ingestInboundMessage,
}))
vi.mock(
  "../../support-inbox/events/publish-support-conversation-updated",
  () => ({
    publishSupportConversationUpdated: publish,
  })
)
vi.mock("@/lib/redis", () => ({
  redisConnection: { duplicate: () => ({ disconnect: async () => undefined }) },
}))

import { handleWaIngressJob } from "./wa-ingress"

const organizationId = "01K1EDN69NFBWCG42B2H99V2C1"
const channelConnectionId = "01K1EDN9C8VT0N8WRM13RM6M55"

describe("wa ingress", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("ingests a Baileys message through the shared pipeline", async () => {
    ingestInboundMessage.mockResolvedValue({
      ok: true,
      value: { jobId: "job", duplicate: false },
    })

    await handleWaIngressJob({
      name: "wa-inbound",
      data: {
        organizationId,
        channelConnectionId,
        senderAddress: "+5511999999999",
        externalMessageId: "BAILEYS1",
        content: { type: "text", body: "Oi" },
        receivedAt: "2026-10-12T12:00:00.000Z",
      },
    })

    expect(ingestInboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channelType: "whatsapp",
        senderAddress: "+5511999999999",
        externalMessageId: "BAILEYS1",
        receivedAt: new Date("2026-10-12T12:00:00.000Z"),
      })
    )
  })

  it("retries when the ingest queue is unavailable", async () => {
    const cause = new Error("redis down")
    ingestInboundMessage.mockResolvedValue({
      ok: false,
      error: { type: "queue_unavailable", cause },
    })

    await expect(
      handleWaIngressJob({
        name: "wa-inbound",
        data: {
          organizationId,
          channelConnectionId,
          senderAddress: "+5511999999999",
          externalMessageId: "BAILEYS1",
          content: { type: "text", body: "Oi" },
          receivedAt: "2026-10-12T12:00:00.000Z",
        },
      })
    ).rejects.toBe(cause)
  })

  it("maps a delivery status onto the shared outbound update", async () => {
    applyDeliveryStatus.mockResolvedValue({
      conversationId: "01K1EDN69NFBWCG42B2H99V2C4",
      changed: true,
    })

    await handleWaIngressJob({
      name: "wa-status",
      data: {
        organizationId,
        channelConnectionId,
        externalMessageId: "BAILEYS1",
        status: "delivered",
      },
    })

    expect(applyDeliveryStatus).toHaveBeenCalledWith({
      organizationId,
      channelConnectionId,
      externalMessageId: "BAILEYS1",
      status: "delivered",
    })
    expect(publish).toHaveBeenCalledWith({
      organizationId,
      conversationId: "01K1EDN69NFBWCG42B2H99V2C4",
    })
  })
})
