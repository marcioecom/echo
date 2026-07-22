import type { Job } from "bullmq"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { createResendClient, renderEmail, send } = vi.hoisted(() => {
  const send = vi.fn()
  return {
    createResendClient: vi.fn(() => ({ emails: { send } })),
    renderEmail: vi.fn(async () => "<html>invite</html>"),
    send,
  }
})

vi.mock("@workspace/email", () => ({
  InviteEmail: vi.fn((props) => props),
  createResendClient,
  renderEmail,
}))

vi.mock("../../config/env", () => ({
  env: {
    RESEND_API_KEY: "re_test",
    EMAIL_FROM: "Echo <invites@echo.dev>",
  },
}))

import { handleSendInvitationEmail } from "./send-invitation-email"

const validPayload = {
  invitationId: "01JFXN7G8C2V1D7A0B3E4F5G6H",
  email: "invitee@example.com",
  inviterName: "Jane Doe",
  organizationName: "Acme",
  inviteUrl:
    "http://localhost:3000/accept-invitation/01JFXN7G8C2V1D7A0B3E4F5G6H",
}

function createJob(data: unknown): Job {
  return { data } as Job
}

describe("handleSendInvitationEmail", () => {
  beforeEach(() => {
    send.mockReset()
    renderEmail.mockClear()
    createResendClient.mockClear()
  })

  it("renders the invite template and sends it through resend", async () => {
    send.mockResolvedValue({ data: { id: "email_1" }, error: null })

    await handleSendInvitationEmail(createJob(validPayload))

    expect(createResendClient).toHaveBeenCalledWith("re_test")
    expect(renderEmail).toHaveBeenCalledOnce()
    expect(send).toHaveBeenCalledWith({
      from: "Echo <invites@echo.dev>",
      to: "invitee@example.com",
      subject: "Jane Doe invited you to Acme on Echo",
      html: "<html>invite</html>",
    })
  })

  it("throws when resend reports a delivery error so the job retries", async () => {
    send.mockResolvedValue({
      data: null,
      error: { name: "validation_error", message: "rate limited" },
    })

    await expect(
      handleSendInvitationEmail(createJob(validPayload))
    ).rejects.toThrow("rate limited")
  })

  it("rejects an invalid payload before sending", async () => {
    await expect(
      handleSendInvitationEmail(createJob({ invitationId: "nope" }))
    ).rejects.toThrow()
    expect(send).not.toHaveBeenCalled()
  })
})
