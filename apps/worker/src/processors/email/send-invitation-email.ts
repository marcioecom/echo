import { InviteEmail, createResendClient, renderEmail } from "@workspace/email"
import { sendInvitationEmailJobSchema } from "@workspace/jobs"
import type { Job } from "bullmq"
import { env } from "../../config/env"

export async function handleSendInvitationEmail(job: Job): Promise<void> {
  const payload = sendInvitationEmailJobSchema.parse(job.data)

  const html = await renderEmail(
    InviteEmail({
      inviterName: payload.inviterName,
      organizationName: payload.organizationName,
      inviteUrl: payload.inviteUrl,
    })
  )

  const resend = createResendClient(env.RESEND_API_KEY)

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: payload.email,
    subject: `${payload.inviterName} invited you to ${payload.organizationName} on Echo`,
    html,
  })

  if (error) {
    throw new Error(`resend delivery failed: ${error.message}`)
  }
}
