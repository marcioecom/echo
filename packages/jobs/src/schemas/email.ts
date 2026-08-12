import { z } from "zod"

import { ulidSchema } from "@workspace/domain"

export const emailQueueName = "email"

export const emailJobNames = {
  sendInvitationEmail: "send-invitation-email",
  sendPasswordResetEmail: "send-password-reset-email",
} as const

export const sendInvitationEmailJobSchema = z.object({
  invitationId: ulidSchema,
  email: z.email(),
  inviterName: z.string().min(1),
  organizationName: z.string().min(1),
  inviteUrl: z.url(),
  logoUrl: z.url(),
})
export type SendInvitationEmailJob = z.infer<
  typeof sendInvitationEmailJobSchema
>

export const sendPasswordResetEmailJobSchema = z.object({
  email: z.email(),
  resetUrl: z.url(),
  logoUrl: z.url(),
})
export type SendPasswordResetEmailJob = z.infer<
  typeof sendPasswordResetEmailJobSchema
>
