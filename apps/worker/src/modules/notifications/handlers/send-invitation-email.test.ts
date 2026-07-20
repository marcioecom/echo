import type { Job } from "bullmq"
import { describe, expect, it } from "vitest"

import { handleSendInvitationEmail } from "./send-invitation-email"

const validPayload = {
  invitationId: "01JFXN7G8C2V1D7A0B3E4F5G6H",
  email: "invitee@example.com",
  inviterName: "Jane Doe",
  organizationName: "Acme",
  inviteUrl: "http://localhost:3000/accept-invitation/01JFXN7G8C2V1D7A0B3E4F5G6H",
}

function createJob(data: unknown): Job {
  return { data } as Job
}

describe("handleSendInvitationEmail", () => {
  it("renders the invite template and sends it through resend", async () => {
    const sent: Array<Record<string, unknown>> = []
    const resend = {
      emails: {
        send: async (args: Record<string, unknown>) => {
          sent.push(args)
          return { data: { id: "email_1" }, error: null }
        },
      },
    }

    await handleSendInvitationEmail(createJob(validPayload), {
      resend: resend as never,
      emailFrom: "Echo <invites@echo.dev>",
    })

    expect(sent).toHaveLength(1)
    expect(sent[0]?.to).toBe("invitee@example.com")
    expect(sent[0]?.from).toBe("Echo <invites@echo.dev>")
    expect(sent[0]?.subject).toContain("Acme")
    expect(sent[0]?.html).toContain(validPayload.inviteUrl)
    expect(sent[0]?.html).toContain("Jane Doe")
  })

  it("throws when resend reports a delivery error so the job retries", async () => {
    const resend = {
      emails: {
        send: async () => ({
          data: null,
          error: { name: "validation_error", message: "rate limited" },
        }),
      },
    }

    await expect(
      handleSendInvitationEmail(createJob(validPayload), {
        resend: resend as never,
        emailFrom: "Echo <invites@echo.dev>",
      }),
    ).rejects.toThrow("rate limited")
  })

  it("rejects an invalid payload before sending", async () => {
    const resend = {
      emails: {
        send: async () => ({ data: { id: "email_1" }, error: null }),
      },
    }

    await expect(
      handleSendInvitationEmail(createJob({ invitationId: "nope" }), {
        resend: resend as never,
        emailFrom: "Echo <invites@echo.dev>",
      }),
    ).rejects.toThrow()
  })
})
