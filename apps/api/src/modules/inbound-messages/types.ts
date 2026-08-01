import type { NormalizedInboundMessage } from "@workspace/domain"

export type InboundChannelMessage = NormalizedInboundMessage

export interface IngestedInboundMessage {
  organizationId: string
  contactId: string
  channelIdentityId: string
  supportConversationId: string
  messageId: string
  duplicate: boolean
}

export interface AuthenticatedTwilioWebhook {
  organizationId: string
  channelConnectionId: string
  channelType: "whatsapp"
  address: string
  form: Record<string, string>
}
