import { z } from "zod"

export const channelTypes = ["whatsapp"] as const
export const channelTypeSchema = z.enum(channelTypes)
export type ChannelType = z.infer<typeof channelTypeSchema>

export const organizationStatuses = ["active", "archived"] as const
export const organizationStatusSchema = z.enum(organizationStatuses)
export type OrganizationStatus = z.infer<typeof organizationStatusSchema>

export const channelConnectionStatuses = [
  "pending",
  "active",
  "disabled",
] as const
export const channelConnectionStatusSchema = z.enum(
  channelConnectionStatuses,
)
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
  supportConversationStatuses,
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
