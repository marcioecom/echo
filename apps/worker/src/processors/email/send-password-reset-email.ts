import { PasswordResetEmail, createResendClient, renderEmail } from "@workspace/email"
import { sendPasswordResetEmailJobSchema } from "@workspace/jobs"
import type { Job } from "bullmq"

import { env } from "../../config/env"

export async function handleSendPasswordResetEmail(job: Job): Promise<void> {
  const payload = sendPasswordResetEmailJobSchema.parse(job.data)

  const html = await renderEmail(
    PasswordResetEmail({
      logoUrl: payload.logoUrl,
      resetUrl: payload.resetUrl
    })
  )

  const resend = createResendClient(env.RESEND_API_KEY)

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: payload.email,
    subject: "Reset your Echo password",
    html,
  })

  if (error) {
    throw new Error(`resend delivery failed: ${error.message}`)
  }
}
