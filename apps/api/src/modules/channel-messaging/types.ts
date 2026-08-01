export interface IngestedInboundMessage {
  organizationId: string
  channelConnectionId: string
  contactId: string
  channelIdentityId: string
  supportConversationId: string
  messageId: string
  duplicate: boolean
}
