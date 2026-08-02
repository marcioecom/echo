import { supportInboxRepository } from "../repositories/support-inbox-repository"

export async function getSupportConversationDetail(input: {
  organizationId: string
  conversationId: string
}) {
  const detail = await supportInboxRepository.findDetail(input)
  if (!detail) return null

  return {
    conversation: {
      ...detail.conversation,
      lastActivityAt: detail.conversation.lastActivityAt.toISOString(),
      resolvedAt: detail.conversation.resolvedAt?.toISOString() ?? null,
    },
    messages: detail.messages.map((message) => ({
      ...message,
      occurredAt: message.occurredAt.toISOString(),
    })),
  }
}
