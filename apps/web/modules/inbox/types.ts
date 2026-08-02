import type {
  ActorType,
  ChannelType,
  MessageContentType,
  MessageDirection,
  MessageStatus,
  SupportConversationStatus,
} from "@workspace/domain"
import { z } from "zod"

export type InboxStatusFilter = SupportConversationStatus | "all"

export interface InboxConversation {
  id: string
  status: SupportConversationStatus
  contact: {
    displayName: string | null
    address: string
    channelType: ChannelType
  }
  lastActivityAt: string
  lastMessage: {
    preview: string
    senderType: ActorType
    contentType: MessageContentType
  } | null
}

export interface InboxConversationPage {
  items: InboxConversation[]
  nextCursor: string | null
}

export interface InboxConversationDetail {
  conversation: {
    id: string
    status: SupportConversationStatus
    contact: InboxConversation["contact"]
    channelConnection: {
      id: string
      name: string
      address: string | null
    }
    lastActivityAt: string
    resolvedAt: string | null
  }
  messages: Array<{
    id: string
    direction: MessageDirection
    senderType: ActorType
    contentType: MessageContentType
    body: string | null
    status: MessageStatus
    occurredAt: string
    operatorName: string | null
  }>
}

export const supportConversationUpdatedEventSchema = z.object({
  type: z.literal("support_conversation.updated"),
  conversationId: z.string(),
})
