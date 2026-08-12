import { beforeEach, describe, expect, it, vi } from "vitest"

const { enqueue, publish, repositoryCreate } = vi.hoisted(() => ({
  enqueue: vi.fn(),
  publish: vi.fn(),
  repositoryCreate: vi.fn(),
}))

vi.mock("@/lib/jobs-client", () => ({ jobs: { enqueue } }))
vi.mock("@workspace/logger", () => ({
  createLoggerWithContext: () => ({ warn: vi.fn() }),
}))
vi.mock("../events/publish-support-conversation-updated", () => ({
  publishSupportConversationUpdated: publish,
}))
vi.mock("../repositories/support-inbox-repository", () => ({
  supportInboxRepository: { createOperatorReply: repositoryCreate },
}))

import { createOperatorReply } from "./create-operator-reply"

const input = {
  organizationId: "01K1EDN69NFBWCG42B2H99V2C1",
  conversationId: "01K1EDN69NFBWCG42B2H99V2C2",
  operatorUserId: "01K1EDN69NFBWCG42B2H99V2C3",
  body: "I can help with that.",
}
const created = {
  type: "created" as const,
  messageId: "01K1EDN69NFBWCG42B2H99V2C4",
  channelConnectionId: "01K1EDN69NFBWCG42B2H99V2C5",
  supportConversationId: input.conversationId,
}

describe("createOperatorReply", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    publish.mockResolvedValue(undefined)
  })

  it("persists, publishes, and enqueues an outbound Message", async () => {
    repositoryCreate.mockResolvedValue(created)
    enqueue.mockResolvedValue({ id: "job-id" })

    await expect(createOperatorReply(input)).resolves.toEqual({
      ok: true,
      value: { type: "created", messageId: created.messageId },
    })
    expect(repositoryCreate).toHaveBeenCalledWith(
      expect.objectContaining(input)
    )
    expect(publish).toHaveBeenCalledWith({
      organizationId: input.organizationId,
      conversationId: input.conversationId,
    })
    expect(enqueue).toHaveBeenCalledWith("send-outbound-message", {
      organizationId: input.organizationId,
      channelConnectionId: created.channelConnectionId,
      supportConversationId: input.conversationId,
      messageId: created.messageId,
    })
  })

  it("does not enqueue replies for missing or resolved conversations", async () => {
    repositoryCreate.mockResolvedValueOnce({ type: "not_found" })
    await expect(createOperatorReply(input)).resolves.toEqual({
      ok: false,
      error: { type: "not_found" },
    })

    repositoryCreate.mockResolvedValueOnce({ type: "resolved" })
    await expect(createOperatorReply(input)).resolves.toEqual({
      ok: false,
      error: { type: "resolved" },
    })

    expect(enqueue).not.toHaveBeenCalled()
    expect(publish).not.toHaveBeenCalled()
  })

  it("keeps the persisted Message visible when the queue is unavailable", async () => {
    repositoryCreate.mockResolvedValue(created)
    enqueue.mockRejectedValue(new Error("Redis unavailable"))

    await expect(createOperatorReply(input)).resolves.toEqual({
      ok: false,
      error: {
        type: "queue_unavailable",
        messageId: created.messageId,
      },
    })
    expect(publish).not.toHaveBeenCalled()
  })

  it("does not fail the reply when realtime notification is unavailable", async () => {
    repositoryCreate.mockResolvedValue(created)
    enqueue.mockResolvedValue({ id: "job-id" })
    publish.mockRejectedValue(new Error("Redis unavailable"))

    await expect(createOperatorReply(input)).resolves.toEqual({
      ok: true,
      value: { type: "created", messageId: created.messageId },
    })
  })
})
