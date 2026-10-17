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
  logoUrl: "http://localhost:3000/brand/echo-logo-horizontal.png",
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

  it("queues a validated password reset email", async () => {
    add.mockResolvedValue({ id: "2" })
    const client = createJobClient({} as never)
    const payload = {
      email: "operator@example.com",
      logoUrl: "http://localhost:3000/brand/echo-logo-horizontal.png",
      resetUrl: "http://localhost:3000/reset-password?token=secret",
    }

    await expect(
      client.enqueue("send-password-reset-email", payload)
    ).resolves.toEqual({ id: "2" })
    expect(add).toHaveBeenCalledWith("send-password-reset-email", payload, {})
  })

  it("enqueues pairing code on the connection queue", async () => {
    add.mockResolvedValue({ id: "pairing-1" })
    const connection = {} as never
    const client = createJobClient(connection)
    const payload = {
      organizationId: "01JFXN7G8C2V1D7A0B3E4F5G6H",
      channelConnectionId: "01JFXN7G8C2V1D7A0B3E4F5G6J",
      phoneNumber: "+5511999999999",
    }

    await expect(client.enqueue("wa-pairing-code", payload)).resolves.toEqual({
      id: "pairing-1",
    })

    expect(constructQueue).toHaveBeenCalledWith(
      `wa-gateway-${payload.channelConnectionId}`,
      {
        connection,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 2_000 },
          removeOnComplete: { age: 86_400, count: 1_000 },
          removeOnFail: { age: 604_800 },
        },
      }
    )
    expect(add).toHaveBeenCalledWith("wa-pairing-code", payload, {})
  })

  it("reuses each connection queue and closes it with the ordinary queues", async () => {
    add.mockResolvedValue({ id: "queued" })
    close.mockResolvedValue(undefined)
    const client = createJobClient({} as never)
    const payload = {
      organizationId: "01JFXN7G8C2V1D7A0B3E4F5G6H",
      channelConnectionId: "01JFXN7G8C2V1D7A0B3E4F5G6J",
      phoneNumber: "+5511999999999",
    }
    await client.enqueue("wa-pairing-code", payload)
    await client.enqueue("wa-pairing-code", payload)
    await client.enqueue("send-invitation-email", validInvitation)
    expect(constructQueue).toHaveBeenCalledTimes(2)
    await client.close()
    expect(close).toHaveBeenCalledTimes(2)
  })

  it("rejects invalid pairing payloads before creating a queue job", async () => {
    const client = createJobClient({} as never)

    await expect(
      client.enqueue("wa-pairing-code", {
        organizationId: "invalid",
        channelConnectionId: "01JFXN7G8C2V1D7A0B3E4F5G6J",
        phoneNumber: "+5511999999999",
      })
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

  it("keeps the index job on the queue backoff and identifies it by document revision", async () => {
    add.mockResolvedValue({ id: "index" })
    const connection = {} as never
    const client = createJobClient(connection)
    const payload = {
      organizationId: "01K1EDN69NFBWCG42B2H99V2C4",
      documentId: "01K1EDN69NFBWCG42B2H99V2C5",
      revision: 5,
    }

    await client.enqueue("index-knowledge-document", payload)

    expect(constructQueue).toHaveBeenCalledWith("knowledge-base", {
      connection,
      defaultJobOptions: {
        attempts: 4,
        backoff: { type: "exponential", delay: 300_000 },
        removeOnComplete: { age: 86_400, count: 1_000 },
        removeOnFail: { age: 604_800 },
      },
    })
    expect(add).toHaveBeenCalledWith("index-knowledge-document", payload, {
      jobId: "index-knowledge-document--01K1EDN69NFBWCG42B2H99V2C5--5",
    })
  })

  it("retries a knowledge object deletion quickly and keeps one job id", async () => {
    add.mockResolvedValue({
      id: "delete-knowledge-object--01K1EDN69NFBWCG42B2H99V2C4",
    })
    const client = createJobClient({} as never)
    const payload = { deletionId: "01K1EDN69NFBWCG42B2H99V2C4" }

    await client.enqueue("delete-knowledge-object", payload)

    expect(add).toHaveBeenCalledWith("delete-knowledge-object", payload, {
      attempts: 8,
      backoff: { type: "exponential", delay: 2_000 },
      jobId: "delete-knowledge-object--01K1EDN69NFBWCG42B2H99V2C4",
    })
  })
})
