import {
  auditEvents,
  channelIdentities,
  messages,
  supportConversations,
} from "@workspace/db/schema"
import { processInboundMessageJobSchema, supportConversationJobNames } from "@workspace/jobs"
import { createId } from "@workspace/domain"
import type { Job } from "bullmq"
import { and, desc, eq, isNull, ne } from "drizzle-orm"

import { database } from "../../lib/db"
import { supportConversationsQueue } from "../../queues/support-conversations"
import { supportAgentGraph } from "./orchestration/support-agent-graph"

export async function handleProcessInboundMessage(job: Job): Promise<void> {
  const payload = processInboundMessageJobSchema.parse(job.data)
  const state = await loadInboundState(payload)
  if (!state) throw new Error("Inbound Message job IDs do not identify one tenant state")

  if (state.contentType !== "text") {
    await handoff(payload, "unsupported_content", "system")
    return
  }
  if (state.status === "human_required" || state.status === "resolved") return

  const activated = await activateIfCurrent(payload)
  if (!activated) return
  const history = await database.db
    .select({ direction: messages.direction, senderType: messages.senderType, body: messages.body })
    .from(messages)
    .where(
      and(
        eq(messages.organizationId, payload.organizationId),
        eq(messages.supportConversationId, payload.supportConversationId)
      )
    )
    .orderBy(desc(messages.occurredAt), desc(messages.id))
    .limit(20)
  const result = await supportAgentGraph.invoke({
    organizationId: payload.organizationId,
    query: state.body ?? "",
    history: history.reverse().map((message) => `${message.senderType}: ${message.body ?? ""}`),
  })
  const decision = result.decision
  if (!decision) throw new Error("Support agent returned no decision")

  if (decision.action === "handoff") {
    await handoff(payload, decision.reason, "ai")
    return
  }

  const created = await database.db.transaction(async (transaction) => {
    const [current] = await transaction
      .select({ status: supportConversations.status })
      .from(supportConversations)
      .where(
        and(
          eq(supportConversations.organizationId, payload.organizationId),
          eq(supportConversations.id, payload.supportConversationId)
        )
      )
      .limit(1)
      .for("update")
    if (!current || current.status !== "ai_active") return null
    const [latest] = await transaction
      .select({ id: messages.id })
      .from(messages)
      .where(
        and(
          eq(messages.organizationId, payload.organizationId),
          eq(messages.supportConversationId, payload.supportConversationId),
          eq(messages.direction, "inbound"),
          eq(messages.senderType, "contact")
        )
      )
      .orderBy(desc(messages.occurredAt), desc(messages.id))
      .limit(1)
    if (latest?.id !== payload.messageId) return null
    const [message] = await transaction
      .insert(messages)
      .values({
        id: createId(),
        organizationId: payload.organizationId,
        supportConversationId: payload.supportConversationId,
        channelConnectionId: state.channelConnectionId,
        direction: "outbound",
        senderType: "ai",
        contentType: "text",
        body: decision.body,
        status: "pending",
        replyToMessageId: payload.messageId,
        occurredAt: new Date(),
      })
      .onConflictDoNothing()
      .returning({ id: messages.id })
    return message ?? null
  })
  if (!created) return
  await supportConversationsQueue.add(
    supportConversationJobNames.sendOutboundMessage,
    {
      organizationId: payload.organizationId,
      channelConnectionId: state.channelConnectionId,
      supportConversationId: payload.supportConversationId,
      messageId: created.id,
    },
    { jobId: `${supportConversationJobNames.sendOutboundMessage}--${created.id}` }
  )
}

async function loadInboundState(input: {
  organizationId: string
  channelIdentityId: string
  supportConversationId: string
  messageId: string
}) {
  const [state] = await database.db
    .select({
      contentType: messages.contentType,
      body: messages.body,
      channelConnectionId: messages.channelConnectionId,
      status: supportConversations.status,
    })
    .from(messages)
    .innerJoin(supportConversations, and(
      eq(supportConversations.organizationId, messages.organizationId),
      eq(supportConversations.id, messages.supportConversationId),
      eq(supportConversations.channelConnectionId, messages.channelConnectionId)
    ))
    .innerJoin(channelIdentities, and(
      eq(channelIdentities.organizationId, supportConversations.organizationId),
      eq(channelIdentities.id, supportConversations.channelIdentityId)
    ))
    .where(and(
      eq(messages.organizationId, input.organizationId),
      eq(messages.id, input.messageId),
      eq(messages.supportConversationId, input.supportConversationId),
      eq(supportConversations.channelIdentityId, input.channelIdentityId),
      eq(messages.direction, "inbound"),
      eq(messages.senderType, "contact")
    ))
    .limit(1)
  return state
}

async function activateIfCurrent(input: {
  organizationId: string
  supportConversationId: string
  messageId: string
}): Promise<boolean> {
  return database.db.transaction(async (transaction) => {
    const [conversation] = await transaction
      .select({ status: supportConversations.status })
      .from(supportConversations)
      .where(and(
        eq(supportConversations.organizationId, input.organizationId),
        eq(supportConversations.id, input.supportConversationId)
      ))
      .limit(1)
      .for("update")
    if (!conversation || conversation.status === "human_required" || conversation.status === "resolved") return false
    const [latest] = await transaction
      .select({ id: messages.id })
      .from(messages)
      .where(and(
        eq(messages.organizationId, input.organizationId),
        eq(messages.supportConversationId, input.supportConversationId),
        eq(messages.direction, "inbound"),
        eq(messages.senderType, "contact")
      ))
      .orderBy(desc(messages.occurredAt), desc(messages.id))
      .limit(1)
    if (latest?.id !== input.messageId) return false
    if (conversation.status === "open") {
      await transaction.update(supportConversations).set({ status: "ai_active" }).where(and(
        eq(supportConversations.organizationId, input.organizationId),
        eq(supportConversations.id, input.supportConversationId),
        isNull(supportConversations.resolvedAt)
      ))
    }
    return true
  })
}

async function handoff(
  input: { organizationId: string; supportConversationId: string; messageId: string },
  reason: "human_requested" | "low_confidence" | "unsupported_policy" | "unsupported_content",
  actorType: "ai" | "system"
): Promise<void> {
  await database.db.transaction(async (transaction) => {
    const transitioned = await transaction.update(supportConversations).set({ status: "human_required" }).where(and(
      eq(supportConversations.organizationId, input.organizationId),
      eq(supportConversations.id, input.supportConversationId),
      isNull(supportConversations.resolvedAt),
      ne(supportConversations.status, "human_required")
    )).returning({ id: supportConversations.id })
    if (transitioned.length === 0) return
    await transaction.insert(auditEvents).values({
      organizationId: input.organizationId,
      eventType: "support_conversation.human_required",
      actorType,
      subjectType: "support_conversation",
      subjectId: input.supportConversationId,
      data: { messageId: input.messageId, reason },
    })
  })
}
