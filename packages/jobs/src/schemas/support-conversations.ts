import { z } from "zod"

import { ulidSchema } from "@workspace/domain"

export const supportConversationsQueueName = "support-conversations"

export const supportConversationJobNames = {
  processInboundMessage: "process-inbound-message",
  sendOutboundMessage: "send-outbound-message",
} as const

export const processInboundMessageJobSchema = z.object({
  organizationId: ulidSchema,
  channelIdentityId: ulidSchema,
  supportConversationId: ulidSchema,
  messageId: ulidSchema,
})
export type ProcessInboundMessageJob = z.infer<
  typeof processInboundMessageJobSchema
>

export const sendOutboundMessageJobSchema = z.object({
  organizationId: ulidSchema,
  channelConnectionId: ulidSchema,
  supportConversationId: ulidSchema,
  messageId: ulidSchema,
})
export type SendOutboundMessageJob = z.infer<
  typeof sendOutboundMessageJobSchema
>
