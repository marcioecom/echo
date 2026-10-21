import { z } from "zod"

import { ulidSchema } from "./ids"

export const channelTypes = ["whatsapp"] as const
export const channelTypeSchema = z.enum(channelTypes)
export type ChannelType = z.infer<typeof channelTypeSchema>

export const channelProviders = ["twilio", "baileys", "meta_cloud"] as const
export const channelProviderSchema = z.enum(channelProviders)
export type ChannelProvider = z.infer<typeof channelProviderSchema>

export const channelSessionStates = [
  "connecting",
  "qr_pending",
  "pairing_code_pending",
  "connected",
  "disconnected",
  "logged_out",
  "banned_suspected",
] as const
export const channelSessionStateSchema = z.enum(channelSessionStates)
export type ChannelSessionState = z.infer<typeof channelSessionStateSchema>

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

export const supportConversationHandoffReasons = [
  "human_requested",
  "low_confidence",
  "unsupported_policy",
  "ai_failure",
  "unsupported_content",
  "transcription_failed",
  "operator_takeover",
] as const
export const supportConversationHandoffReasonSchema = z.enum(
  supportConversationHandoffReasons
)
export type SupportConversationHandoffReason = z.infer<
  typeof supportConversationHandoffReasonSchema
>

export function supportConversationDispatchLockKey(input: {
  organizationId: string
  conversationId: string
}): string {
  return `support-conversation-dispatch:${input.organizationId}:${input.conversationId}`
}

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

export const messageContentTypes = ["text", "audio", "unsupported"] as const
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

export const messageMediaKinds = ["audio"] as const
export const messageMediaKindSchema = z.enum(messageMediaKinds)
export type MessageMediaKind = z.infer<typeof messageMediaKindSchema>

export const messageMediaDownloadStatuses = [
  "pending",
  "stored",
  "failed",
] as const
export const messageMediaDownloadStatusSchema = z.enum(
  messageMediaDownloadStatuses
)
export type MessageMediaDownloadStatus = z.infer<
  typeof messageMediaDownloadStatusSchema
>

export const messageTranscriptionStatuses = [
  "pending",
  "transcribing",
  "completed",
  "failed",
] as const
export const messageTranscriptionStatusSchema = z.enum(
  messageTranscriptionStatuses
)
export type MessageTranscriptionStatus = z.infer<
  typeof messageTranscriptionStatusSchema
>

export const supportedInboundAudioMimeTypes = [
  "audio/ogg",
  "audio/opus",
  "audio/mpeg",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/amr",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/flac",
] as const

export const maxInboundAudioBytes = 16 * 1024 * 1024

export function normalizeAudioMimeType(mimeType: string): string {
  return mimeType.split(";")[0]!.trim().toLowerCase()
}

export function isSupportedInboundAudioMimeType(mimeType: string): boolean {
  const normalized = normalizeAudioMimeType(mimeType)
  return (supportedInboundAudioMimeTypes as readonly string[]).includes(
    normalized
  )
}

const audioFileExtensions = {
  "audio/ogg": "ogg",
  "audio/opus": "opus",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/m4a": "m4a",
  "audio/x-m4a": "m4a",
  "audio/amr": "amr",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/webm": "webm",
  "audio/flac": "flac",
} as const

export function audioFileExtension(mimeType: string): string {
  const normalized = normalizeAudioMimeType(mimeType)
  return (
    audioFileExtensions[normalized as keyof typeof audioFileExtensions] ?? "bin"
  )
}

export function inboundMediaObjectKey(input: {
  organizationId: string
  channelConnectionId: string
  externalMessageId: string
  mimeType: string
}): string {
  const extension = audioFileExtension(input.mimeType)
  return `organizations/${input.organizationId}/channels/${input.channelConnectionId}/inbound/${input.externalMessageId}.${extension}`
}

export const inboundMediaRefSchema = z
  .object({
    url: z.url().optional(),
    externalMessageId: z.string().min(1).optional(),
  })
  .refine((value) => Boolean(value.url ?? value.externalMessageId), {
    message: "media ref requires a url or an external message id",
  })
export type InboundMediaRef = z.infer<typeof inboundMediaRefSchema>

export const inboundMediaSchema = z.object({
  mimeType: z.string().trim().min(1),
  sizeBytes: z.number().int().positive().optional(),
  durationMs: z.number().int().positive().optional(),
  ref: inboundMediaRefSchema,
})
export type InboundMedia = z.infer<typeof inboundMediaSchema>

export const inboundMessageContentSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text"),
    body: z.string().trim().min(1),
  }),
  z.object({
    type: z.literal("audio"),
    media: inboundMediaSchema,
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
