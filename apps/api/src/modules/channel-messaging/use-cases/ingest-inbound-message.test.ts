import { beforeEach, describe, expect, it, vi } from "vitest"

const { enqueue, logError, logInfo, publish, repositoryIngest } = vi.hoisted(
  () => ({
    enqueue: vi.fn(),
    logError: vi.fn(),
    logInfo: vi.fn(),
    publish: vi.fn(),
    repositoryIngest: vi.fn(),
  })
)

vi.mock("@workspace/logger", () => ({
  createLoggerWithContext: () => ({ error: logError, info: logInfo }),
}))
vi.mock("../../../lib/jobs-client", () => ({ jobs: { enqueue } }))
vi.mock("../repositories/inbound-message-repository", () => ({
  inboundMessageRepository: { ingest: repositoryIngest },
}))
vi.mock("../../support-inbox/events/publish-support-conversation-updated", () => ({
  publishSupportConversationUpdated: publish,
}))

import { ingestInboundMessage } from "./ingest-inbound-message"

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
  channelConnectionId: input.channelConnectionId,
  contactId: "01K1EDN69NFBWCG42B2H99V2C2",
  channelIdentityId: "01K1EDN69NFBWCG42B2H99V2C3",
  supportConversationId: "01K1EDN69NFBWCG42B2H99V2C4",
  messageId: "01K1EDN69NFBWCG42B2H99V2C5",
  duplicate: false,
}

describe("ingestInboundMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("publishes an IDs-only job after persistence", async () => {
    repositoryIngest.mockResolvedValue(ingested)
    enqueue.mockResolvedValue({ id: "job-id" })

    await expect(ingestInboundMessage(input)).resolves.toEqual({
      ok: true,
      value: { ...ingested, jobId: "job-id" },
    })
    expect(repositoryIngest).toHaveBeenCalledWith(input)
    expect(publish).toHaveBeenCalledWith({
      organizationId: ingested.organizationId,
      conversationId: ingested.supportConversationId,
    })
    expect(enqueue).toHaveBeenCalledWith("process-inbound-message", {
      organizationId: ingested.organizationId,
      channelIdentityId: ingested.channelIdentityId,
      supportConversationId: ingested.supportConversationId,
      messageId: ingested.messageId,
    })
    expect(repositoryIngest.mock.invocationCallOrder[0]).toBeLessThan(
      enqueue.mock.invocationCallOrder[0]!
    )
    expect(logInfo).toHaveBeenCalledWith(
      "Inbound Message ingested",
      expect.objectContaining({
        channelConnectionId: ingested.channelConnectionId,
        jobId: "job-id",
      })
    )
  })

  it("preserves committed IDs and the cause when enqueue fails", async () => {
    const cause = new Error("Redis unavailable")
    repositoryIngest.mockResolvedValue(ingested)
    enqueue.mockRejectedValue(cause)

    await expect(ingestInboundMessage(input)).resolves.toEqual({
      ok: false,
      error: { type: "queue_unavailable", ingested, cause },
    })
    expect(logError).toHaveBeenCalledWith(
      "Inbound Message processing failed",
      expect.objectContaining({ err: cause, messageId: ingested.messageId })
    )
    expect(publish).toHaveBeenCalledOnce()
  })
})
