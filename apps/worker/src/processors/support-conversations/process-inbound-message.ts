import {
  auditEvents,
  channelIdentities,
  messages,
  supportConversations,
} from "@workspace/db/schema"
import { processInboundMessageJobSchema } from "@workspace/jobs"
import type { Job } from "bullmq"
import { and, eq, isNull, ne } from "drizzle-orm"
import { database } from "../../lib/db"

export async function handleProcessInboundMessage(job: Job): Promise<void> {
  const payload = processInboundMessageJobSchema.parse(job.data)

  await database.db.transaction(async (transaction) => {
    const [state] = await transaction
      .select({
        contentType: messages.contentType,
      })
      .from(messages)
      .innerJoin(
        supportConversations,
        and(
          eq(supportConversations.organizationId, messages.organizationId),
          eq(supportConversations.id, messages.supportConversationId),
          eq(
            supportConversations.channelConnectionId,
            messages.channelConnectionId
          )
        )
      )
      .innerJoin(
        channelIdentities,
        and(
          eq(
            channelIdentities.organizationId,
            supportConversations.organizationId
          ),
          eq(channelIdentities.id, supportConversations.channelIdentityId)
        )
      )
      .where(
        and(
          eq(messages.organizationId, payload.organizationId),
          eq(messages.id, payload.messageId),
          eq(messages.supportConversationId, payload.supportConversationId),
          eq(supportConversations.organizationId, payload.organizationId),
          eq(supportConversations.id, payload.supportConversationId),
          eq(supportConversations.channelIdentityId, payload.channelIdentityId),
          eq(channelIdentities.organizationId, payload.organizationId),
          eq(channelIdentities.id, payload.channelIdentityId),
          eq(messages.direction, "inbound"),
          eq(messages.senderType, "contact")
        )
      )
      .limit(1)

    if (!state) {
      throw new Error(
        "Inbound Message job IDs do not identify one tenant state"
      )
    }

    if (state.contentType === "text") return

    const transitioned = await transaction
      .update(supportConversations)
      .set({ status: "human_required" })
      .where(
        and(
          eq(supportConversations.organizationId, payload.organizationId),
          eq(supportConversations.id, payload.supportConversationId),
          eq(supportConversations.channelIdentityId, payload.channelIdentityId),
          isNull(supportConversations.resolvedAt),
          ne(supportConversations.status, "human_required")
        )
      )
      .returning({ id: supportConversations.id })

    if (transitioned.length === 0) return

    await transaction.insert(auditEvents).values({
      organizationId: payload.organizationId,
      eventType: "support_conversation.human_required",
      actorType: "system",
      subjectType: "support_conversation",
      subjectId: payload.supportConversationId,
      data: { messageId: payload.messageId, reason: "unsupported_content" },
    })
  })
}
