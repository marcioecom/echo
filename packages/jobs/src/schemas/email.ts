import { z } from "zod"

import { ulidSchema } from "@workspace/domain"

export const emailQueueName = "email"

export const emailJobNames = {
  sendInvitationEmail: "send-invitation-email",
} as const
export type EmailJobName = (typeof emailJobNames)[keyof typeof emailJobNames]

export const sendInvitationEmailJobSchema = z.object({
  invitationId: ulidSchema,
  email: z.email(),
  inviterName: z.string().min(1),
  organizationName: z.string().min(1),
  inviteUrl: z.url(),
})
export type SendInvitationEmailJob = z.infer<
  typeof sendInvitationEmailJobSchema
>
