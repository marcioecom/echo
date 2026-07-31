import { z } from "zod"

import { ulidSchema } from "./ids"

export const channelTypes = ["whatsapp"] as const
export const channelTypeSchema = z.enum(channelTypes)
export type ChannelType = z.infer<typeof channelTypeSchema>

export const channelProviders = ["twilio"] as const
export const channelProviderSchema = z.enum(channelProviders)
export type ChannelProvider = z.infer<typeof channelProviderSchema>

export const organizationStatuses = ["active", "archived"] as const
export const organizationStatusSchema = z.enum(organizationStatuses)
export type OrganizationStatus = z.infer<typeof organizationStatusSchema>

export const channelConnectionStatuses = [
  "pending",
  "active",
  "disabled",
] as const
export const channelConnectionStatusSchema = z.enum(channelConnectionStatuses)
export type ChannelConnectionStatus = z.infer<
  typeof channelConnectionStatusSchema
>

export const supportConversationStatuses = [
  "open",
  "ai_active",
  "human_required",
  "resolved",
] as const
export const supportConversationStatusSchema = z.enum(
  supportConversationStatuses
)
export type SupportConversationStatus = z.infer<
  typeof supportConversationStatusSchema
>

export const messageDirections = ["inbound", "outbound"] as const
export const messageDirectionSchema = z.enum(messageDirections)
export type MessageDirection = z.infer<typeof messageDirectionSchema>

export const actorTypes = ["contact", "ai", "operator", "system"] as const
export const actorTypeSchema = z.enum(actorTypes)
export type ActorType = z.infer<typeof actorTypeSchema>

export const messageStatuses = [
  "received",
  "pending",
  "sent",
  "delivered",
  "read",
  "failed",
] as const
export const messageStatusSchema = z.enum(messageStatuses)
export type MessageStatus = z.infer<typeof messageStatusSchema>

export const messageContentTypes = ["text", "unsupported"] as const
export const messageContentTypeSchema = z.enum(messageContentTypes)
export type MessageContentType = z.infer<typeof messageContentTypeSchema>

export const unsupportedMediaKinds = [
  "image",
  "audio",
  "video",
  "document",
  "unknown",
] as const
export const unsupportedMediaKindSchema = z.enum(unsupportedMediaKinds)
export type UnsupportedMediaKind = z.infer<typeof unsupportedMediaKindSchema>

export const inboundMessageContentSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text"),
    body: z.string().trim().min(1),
  }),
  z.object({
    type: z.literal("unsupported"),
    mediaKind: unsupportedMediaKindSchema.optional(),
  }),
])
export type InboundMessageContent = z.infer<typeof inboundMessageContentSchema>

export const normalizedInboundMessageSchema = z.object({
  organizationId: ulidSchema,
  channelConnectionId: ulidSchema,
  channelType: z.literal("whatsapp"),
  senderAddress: z.string().regex(/^\+[1-9]\d{1,14}$/),
  senderDisplayName: z.string().trim().min(1).optional(),
  externalMessageId: z.string().min(1),
  content: inboundMessageContentSchema,
  receivedAt: z.date(),
})
export type NormalizedInboundMessage = z.infer<
  typeof normalizedInboundMessageSchema
>
