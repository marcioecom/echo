import { z } from "zod"

import { ulidSchema } from "@workspace/domain"

export const supportConversationsQueueName = "support-conversations"

export const supportConversationJobNames = {
  processInboundMessage: "process-inbound-message",
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
