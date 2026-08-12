import type { Job } from "bullmq"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { createResendClient, renderEmail, send } = vi.hoisted(() => {
  const send = vi.fn()
  return {
    createResendClient: vi.fn(() => ({ emails: { send } })),
    renderEmail: vi.fn(async () => "<html>reset</html>"),
    send,
  }
})

vi.mock("@workspace/email", () => ({
  PasswordResetEmail: vi.fn((props) => props),
  createResendClient,
  renderEmail,
}))

vi.mock("../../config/env", () => ({
  env: {
    RESEND_API_KEY: "re_test",
    EMAIL_FROM: "Echo <security@echo.dev>",
  },
}))

import { handleSendPasswordResetEmail } from "./send-password-reset-email"

function createJob(data: unknown): Job {
  return { data } as Job
}

describe("handleSendPasswordResetEmail", () => {
  beforeEach(() => {
    send.mockReset()
    renderEmail.mockClear()
    createResendClient.mockClear()
  })

  it("renders and sends the password reset email", async () => {
    send.mockResolvedValue({ data: { id: "email_1" }, error: null })
    const resetUrl = "http://localhost:3000/reset-password?token=secret"

    await handleSendPasswordResetEmail(
      createJob({
        email: "operator@example.com",
        logoUrl: "http://localhost:3000/brand/echo-logo-horizontal.png",
        resetUrl,
      })
    )

    expect(createResendClient).toHaveBeenCalledWith("re_test")
    expect(renderEmail).toHaveBeenCalledOnce()
    expect(send).toHaveBeenCalledWith({
      from: "Echo <security@echo.dev>",
      to: "operator@example.com",
      subject: "Reset your Echo password",
      html: "<html>reset</html>",
    })
  })

  it("throws when Resend fails so the job retries", async () => {
    send.mockResolvedValue({
      data: null,
      error: { name: "validation_error", message: "rate limited" },
    })

    await expect(
      handleSendPasswordResetEmail(
        createJob({
          email: "operator@example.com",
          logoUrl: "http://localhost:3000/brand/echo-logo-horizontal.png",
          resetUrl: "http://localhost:3000/reset-password?token=secret",
        })
      )
    ).rejects.toThrow("rate limited")
  })
})
