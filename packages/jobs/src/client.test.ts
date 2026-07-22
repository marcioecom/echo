import { beforeEach, describe, expect, it, vi } from "vitest"

const { add, close } = vi.hoisted(() => ({
  add: vi.fn(),
  close: vi.fn(),
}))

vi.mock("bullmq", () => ({
  Queue: class {
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
  })

  it("enqueues the payload and returns the BullMQ job id", async () => {
    add.mockResolvedValue({ id: "1" })
    const client = createJobClient({} as never)

    await expect(
      client.enqueue("send-invitation-email", validInvitation, "email")
    ).resolves.toEqual({ id: "1" })
    expect(add).toHaveBeenCalledWith(
      "send-invitation-email",
      validInvitation,
      {}
    )
  })

  it("rejects when BullMQ does not return a job id", async () => {
    add.mockResolvedValue({})
    const client = createJobClient({} as never)

    await expect(
      client.enqueue("send-invitation-email", validInvitation, "email")
    ).rejects.toThrow("Failed to enqueue job: send-invitation-email")
  })
})
