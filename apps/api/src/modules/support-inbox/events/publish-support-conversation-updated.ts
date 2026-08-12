import { publishInboxEvent } from "@workspace/jobs"

import { redisConnection } from "@/lib/redis"

export function publishSupportConversationUpdated(input: {
  organizationId: string
  conversationId: string
}): Promise<void> {
  return publishInboxEvent(redisConnection, input.organizationId, {
    type: "support_conversation.updated",
    conversationId: input.conversationId,
  })
}
