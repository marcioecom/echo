import { beforeEach, describe, expect, it, vi } from "vitest"

const { add, close, constructQueue } = vi.hoisted(() => ({
  add: vi.fn(),
  close: vi.fn(),
  constructQueue: vi.fn(),
}))

vi.mock("bullmq", () => ({
  Queue: class {
    constructor(name: string, options: unknown) {
      constructQueue(name, options)
    }

    add = add
    close = close
  },
}))

import { createJobClient } from "./client"

const validInvitation = {
  invitationId: "01JFXN7G8C2V1D7A0B3E4F5G6H",
  email: "invitee@example.com",
  inviterName: "Jane Doe",
  organizationName: "Acme",
  inviteUrl:
    "http://localhost:3000/accept-invitation/01JFXN7G8C2V1D7A0B3E4F5G6H",
}

describe("createJobClient", () => {
  beforeEach(() => {
    add.mockReset()
    close.mockReset()
    constructQueue.mockReset()
  })

  it("validates the payload and returns the BullMQ job id", async () => {
    add.mockResolvedValue({ id: "1" })
    const client = createJobClient({} as never)

    await expect(
      client.enqueue("send-invitation-email", validInvitation)
    ).resolves.toEqual({ id: "1" })
    expect(add).toHaveBeenCalledWith(
      "send-invitation-email",
      validInvitation,
      {}
    )
  })

  it("rejects invalid payloads before creating a queue job", async () => {
    const client = createJobClient({} as never)

    await expect(
      client.enqueue("send-invitation-email", {
        invitationId: "invalid",
      } as never)
    ).rejects.toThrow()
    expect(add).not.toHaveBeenCalled()
  })

  it("applies queue defaults and a deterministic job ID", async () => {
    add.mockResolvedValue({
      id: "process-inbound-message--01JFXN7G8C2V1D7A0B3E4F5G6H",
    })
    const connection = {} as never
    const client = createJobClient(connection)
    const payload = {
      organizationId: "01JFXN7G8C2V1D7A0B3E4F5G6H",
      channelIdentityId: "01JFXN7G8C2V1D7A0B3E4F5G6J",
      supportConversationId: "01JFXN7G8C2V1D7A0B3E4F5G6K",
      messageId: "01JFXN7G8C2V1D7A0B3E4F5G6M",
      senderAddress: "+5511999999999",
      body: "sensitive",
    }

    await client.enqueue("process-inbound-message", payload)

    expect(constructQueue).toHaveBeenCalledWith("support-conversations", {
      connection,
      defaultJobOptions: {
        attempts: 4,
        backoff: { type: "exponential", delay: 300_000 },
        removeOnComplete: { age: 86_400, count: 1_000 },
        removeOnFail: { age: 604_800 },
      },
    })
    expect(add).toHaveBeenCalledWith(
      "process-inbound-message",
      {
        organizationId: payload.organizationId,
        channelIdentityId: payload.channelIdentityId,
        supportConversationId: payload.supportConversationId,
        messageId: payload.messageId,
      },
      {
        jobId: `process-inbound-message--${payload.messageId}`,
      }
    )
  })
})
