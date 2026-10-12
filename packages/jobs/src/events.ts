import type { Redis } from "ioredis"
import { z } from "zod"

import { ulidSchema } from "@workspace/domain"

export const supportConversationUpdatedEventSchema = z.object({
  type: z.literal("support_conversation.updated"),
  conversationId: ulidSchema,
})
export type SupportConversationUpdatedEvent = z.infer<
  typeof supportConversationUpdatedEventSchema
>

export const channelStatusChangedEventSchema = z.object({
  type: z.literal("channel.status_changed"),
  channelConnectionId: ulidSchema,
})
export type ChannelStatusChangedEvent = z.infer<
  typeof channelStatusChangedEventSchema
>

export const inboxEventSchema = z.discriminatedUnion("type", [
  supportConversationUpdatedEventSchema,
  channelStatusChangedEventSchema,
])
export type InboxEvent = z.infer<typeof inboxEventSchema>

export const inboxEventChannelPattern = "inbox-events:*"

export function inboxEventChannel(organizationId: string): string {
  return `inbox-events:${organizationId}`
}

export async function publishInboxEvent(
  redis: Pick<Redis, "publish">,
  organizationId: string,
  event: InboxEvent
): Promise<void> {
  await redis.publish(inboxEventChannel(organizationId), JSON.stringify(event))
}

export function parseInboxEvent(
  channel: string,
  raw: string
): { organizationId: string; event: InboxEvent } | null {
  const organizationId = channel.slice("inbox-events:".length)
  if (!ulidSchema.safeParse(organizationId).success) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    const result = inboxEventSchema.safeParse(parsed)
    if (!result.success) return null
    return { organizationId, event: result.data }
  } catch {
    return null
  }
}
