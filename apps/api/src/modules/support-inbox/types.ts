import type {
  ActorType,
  ChannelType,
  MessageContentType,
  MessageDirection,
  MessageStatus,
  SupportConversationStatus,
} from "@workspace/domain"

export interface SupportInboxCursor {
  lastActivityAt: Date
  id: string
}

export interface SupportInboxConversation {
  id: string
  status: SupportConversationStatus
  contact: {
    displayName: string | null
    address: string
    channelType: ChannelType
  }
  lastActivityAt: Date
  lastMessage: {
    preview: string
    senderType: ActorType
    contentType: MessageContentType
  } | null
}

export interface SupportInboxConversationDetail {
  conversation: {
    id: string
    status: SupportConversationStatus
    contact: {
      displayName: string | null
      address: string
      channelType: ChannelType
    }
    channelConnection: {
      id: string
      name: string
      address: string | null
    }
    lastActivityAt: Date
    resolvedAt: Date | null
  }
  messages: Array<{
    id: string
    direction: MessageDirection
    senderType: ActorType
    contentType: MessageContentType
    body: string | null
    status: MessageStatus
    occurredAt: Date
    operatorName: string | null
  }>
}

export interface SupportConversationUpdatedEvent {
  type: "support_conversation.updated"
  conversationId: string
}
