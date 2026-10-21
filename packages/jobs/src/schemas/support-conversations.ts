import type { JobsOptions } from "bullmq"
import { z } from "zod"

import { ulidSchema } from "@workspace/domain"

export const supportConversationsQueueName = "support-conversations"

export const supportConversationJobNames = {
  processInboundMessage: "process-inbound-message",
  sendOutboundMessage: "send-outbound-message",
  fetchInboundMedia: "fetch-inbound-media",
  transcribeInboundAudio: "transcribe-inbound-audio",
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

export const fetchInboundMediaJobSchema = z.object({
  organizationId: ulidSchema,
  channelConnectionId: ulidSchema,
  supportConversationId: ulidSchema,
  messageId: ulidSchema,
})
export type FetchInboundMediaJob = z.infer<typeof fetchInboundMediaJobSchema>

export const transcribeInboundAudioJobSchema = fetchInboundMediaJobSchema
export type TranscribeInboundAudioJob = z.infer<
  typeof transcribeInboundAudioJobSchema
>

/**
 * Media work runs in front of an operator waiting for an answer, so it uses a
 * shorter backoff than the queue default.
 */
export const inboundMediaJobOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 15_000 },
} satisfies JobsOptions
