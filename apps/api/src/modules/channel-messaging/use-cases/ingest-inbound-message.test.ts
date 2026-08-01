import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../../../lib/db", () => ({ database: { db: {} } }))
vi.mock("../../../lib/jobs-client", () => ({ jobs: { enqueue: vi.fn() } }))

import { createIngestInboundMessage } from "./ingest-inbound-message"

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
  const persist = vi.fn()
  const enqueue = vi.fn()
  const ingestInboundMessage = createIngestInboundMessage({
    repository: { persist },
    enqueue,
  })

  beforeEach(() => {
    enqueue.mockReset()
    persist.mockReset()
  })

  it("publishes an IDs-only job after persistence", async () => {
    persist.mockResolvedValue(ingested)
    enqueue.mockResolvedValue({ id: "job-id" })

    await expect(ingestInboundMessage(input)).resolves.toEqual({
      ok: true,
      value: { ...ingested, jobId: "job-id" },
    })
    expect(enqueue).toHaveBeenCalledWith("process-inbound-message", {
      organizationId: ingested.organizationId,
      channelIdentityId: ingested.channelIdentityId,
      supportConversationId: ingested.supportConversationId,
      messageId: ingested.messageId,
    })
  })

  it("preserves committed IDs when enqueue fails", async () => {
    persist.mockResolvedValue(ingested)
    enqueue.mockRejectedValue(new Error("Redis unavailable"))

    await expect(ingestInboundMessage(input)).resolves.toEqual({
      ok: false,
      error: { type: "queue_unavailable", ingested },
    })
  })
})
