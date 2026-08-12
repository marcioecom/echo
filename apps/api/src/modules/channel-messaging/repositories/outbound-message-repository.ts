import { auditEvents, messages } from "@workspace/db/schema"
import type { MessageStatus } from "@workspace/domain"
import { and, eq } from "drizzle-orm"

import { database } from "@/lib/db"

const statusRank: Record<Extract<MessageStatus, "pending" | "sent" | "delivered" | "read">, number> = {
  pending: 0,
  sent: 1,
  delivered: 2,
  read: 3,
}

export class OutboundMessageRepository {
  async applyDeliveryStatus(input: {
    organizationId: string
    channelConnectionId: string
    externalMessageId: string
    status: Extract<MessageStatus, "pending" | "sent" | "delivered" | "read" | "failed">
  }): Promise<{ conversationId: string; changed: boolean } | null> {
    return database.db.transaction(async (transaction) => {
      const [message] = await transaction
        .select({
          id: messages.id,
          status: messages.status,
          supportConversationId: messages.supportConversationId,
        })
        .from(messages)
        .where(
          and(
            eq(messages.organizationId, input.organizationId),
            eq(messages.channelConnectionId, input.channelConnectionId),
            eq(messages.externalMessageId, input.externalMessageId),
            eq(messages.direction, "outbound")
          )
        )
        .limit(1)
        .for("update")
      if (!message) return null

      const changed = shouldApplyStatus(message.status, input.status)
      if (!changed) {
        return { conversationId: message.supportConversationId, changed: false }
      }

      await transaction
        .update(messages)
        .set({ status: input.status })
        .where(eq(messages.id, message.id))

      if (input.status === "failed") {
        await transaction.insert(auditEvents).values({
          organizationId: input.organizationId,
          eventType: "message.outbound_delivery_failed",
          actorType: "system",
          subjectType: "message",
          subjectId: message.id,
          data: { reason: "status_callback" },
        })
      }

      return { conversationId: message.supportConversationId, changed: true }
    })
  }
}

function shouldApplyStatus(
  current: MessageStatus,
  next: Extract<MessageStatus, "pending" | "sent" | "delivered" | "read" | "failed">
): boolean {
  if (current === "failed" || current === "read" || current === "received") {
    return false
  }
  if (next === "failed") return true
  if (current === "pending" || current === "sent" || current === "delivered") {
    return statusRank[next] > statusRank[current]
  }
  return false
}

export const outboundMessageRepository = new OutboundMessageRepository()
