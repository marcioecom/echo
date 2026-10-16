import {
  auditEvents,
  channelConnectionProviderBindings,
  channelIdentities,
  messages,
  supportConversations,
} from "@workspace/db/schema"
import {
  createId,
  type SupportConversationHandoffReason,
  type SupportConversationStatus,
} from "@workspace/domain"
import {
  processInboundMessageJobSchema,
  supportConversationJobNames,
} from "@workspace/jobs"
import { createSupportAgent } from "@workspace/agent"
import type { Job } from "bullmq"
import { and, desc, eq, isNull, ne, sql } from "drizzle-orm"

import { env } from "../../config/env"
import { database } from "../../lib/db"
import { supportConversationsQueue } from "../../queues/support-conversations"

const handoffFallbackCustomerMessage =
  "Vou chamar alguém da equipe pra continuar com você. I'll ask someone from the team to continue with you."

const { graph: supportAgentGraph, draftUnsupportedHandoffCopy } =
  createSupportAgent({
    database: database.db,
    apiKey: env.AI_GATEWAY_API_KEY,
    chatModel: env.AI_CHAT_MODEL,
    embeddingModel: env.AI_EMBEDDING_MODEL,
  })

type AgentDecision = NonNullable<
  Awaited<ReturnType<typeof supportAgentGraph.invoke>>["decision"]
>

type InboundMessageState = {
  contentType: "text" | "unsupported"
  body: string | null
  channelConnectionId: string
  status: SupportConversationStatus
  channelProvider: string | null
}

export async function handleProcessInboundMessage(job: Job): Promise<void> {
  const payload = processInboundMessageJobSchema.parse(job.data)
  const state = await loadInboundState(payload)
  if (!state)
    throw new Error("Inbound Message job IDs do not identify one tenant state")
  if (state.status === "human_required" || state.status === "resolved") return

  if (state.contentType !== "text") {
    await handoffUnsupported(job, payload, state)
    return
  }

  const activated = await activateIfCurrent(payload)
  if (!activated) return
  const history = await loadHistory(payload)
  const channelProvider = state.channelProvider ?? "unknown"
  let decision: AgentDecision
  try {
    const result = await supportAgentGraph.invoke(
      {
        organizationId: payload.organizationId,
        query: state.body ?? "",
        history,
      },
      {
        runName: "support-agent",
        tags: ["support-agent", "inbound-message", channelProvider],
        metadata: {
          organizationId: payload.organizationId,
          conversationId: payload.supportConversationId,
          messageId: payload.messageId,
          channelProvider,
          model: env.AI_CHAT_MODEL,
        },
      }
    )
    if (!result.decision) throw new Error("Support agent returned no decision")
    decision = result.decision
  } catch (error) {
    if (isFinalAttempt(job)) {
      await handoff(payload, state, "ai_failure", "ai", {
        customerMessage: handoffFallbackCustomerMessage,
        summary: null,
      })
    }
    throw error
  }

  if (decision.action === "handoff") {
    await handoff(payload, state, decision.reason, "ai", {
      customerMessage: decision.customerMessage,
      summary: decision.summary,
    })
    return
  }

  const created = await createAiReply(payload, state, decision.body)
  if (!created) return
  await enqueueOutboundMessage({
    organizationId: payload.organizationId,
    channelConnectionId: state.channelConnectionId,
    supportConversationId: payload.supportConversationId,
    messageId: created.id,
  })
}

async function handoffUnsupported(
  job: Job,
  payload: {
    organizationId: string
    supportConversationId: string
    messageId: string
  },
  state: InboundMessageState
): Promise<void> {
  const history = await loadHistory(payload)
  const mediaKind = await loadMediaKind(payload)
  let notice: { customerMessage: string; summary: string | null }
  try {
    notice = await draftUnsupportedHandoffCopy({ history, mediaKind })
  } catch (error) {
    if (!isFinalAttempt(job)) throw error
    notice = {
      customerMessage: handoffFallbackCustomerMessage,
      summary: null,
    }
  }
  await handoff(payload, state, "unsupported_content", "system", notice)
}

function isFinalAttempt(job: Job): boolean {
  return (job.attemptsMade ?? 0) + 1 >= (job.opts?.attempts ?? 1)
}

async function loadHistory(input: {
  organizationId: string
  supportConversationId: string
}): Promise<string[]> {
  const history = await database.db
    .select({
      senderType: messages.senderType,
      body: messages.body,
    })
    .from(messages)
    .where(
      and(
        eq(messages.organizationId, input.organizationId),
        eq(messages.supportConversationId, input.supportConversationId)
      )
    )
    .orderBy(desc(messages.occurredAt), desc(messages.id))
    .limit(20)
  return history
    .reverse()
    .map((message) => `${message.senderType}: ${message.body ?? ""}`)
}

async function loadMediaKind(input: {
  organizationId: string
  messageId: string
}): Promise<string> {
  const [event] = await database.db
    .select({ data: auditEvents.data })
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.organizationId, input.organizationId),
        eq(auditEvents.subjectType, "message"),
        eq(auditEvents.subjectId, input.messageId),
        eq(auditEvents.eventType, "message.unsupported_content")
      )
    )
    .limit(1)
  const mediaKind = event?.data.mediaKind
  return typeof mediaKind === "string" && mediaKind.length > 0
    ? mediaKind
    : "unknown"
}

async function loadInboundState(input: {
  organizationId: string
  channelIdentityId: string
  supportConversationId: string
  messageId: string
}): Promise<InboundMessageState | undefined> {
  const [state] = await database.db
    .select({
      contentType: messages.contentType,
      body: messages.body,
      channelConnectionId: messages.channelConnectionId,
      status: supportConversations.status,
      channelProvider: channelConnectionProviderBindings.provider,
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
    .leftJoin(
      channelConnectionProviderBindings,
      and(
        eq(
          channelConnectionProviderBindings.organizationId,
          messages.organizationId
        ),
        eq(
          channelConnectionProviderBindings.channelConnectionId,
          messages.channelConnectionId
        )
      )
    )
    .where(
      and(
        eq(messages.organizationId, input.organizationId),
        eq(messages.id, input.messageId),
        eq(messages.supportConversationId, input.supportConversationId),
        eq(supportConversations.channelIdentityId, input.channelIdentityId),
        eq(messages.direction, "inbound"),
        eq(messages.senderType, "contact")
      )
    )
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
      .where(
        and(
          eq(supportConversations.organizationId, input.organizationId),
          eq(supportConversations.id, input.supportConversationId)
        )
      )
      .limit(1)
      .for("update")
    if (
      !conversation ||
      conversation.status === "human_required" ||
      conversation.status === "resolved"
    )
      return false
    const [latest] = await transaction
      .select({ id: messages.id })
      .from(messages)
      .where(
        and(
          eq(messages.organizationId, input.organizationId),
          eq(messages.supportConversationId, input.supportConversationId),
          eq(messages.direction, "inbound"),
          eq(messages.senderType, "contact")
        )
      )
      .orderBy(desc(messages.occurredAt), desc(messages.id))
      .limit(1)
    if (latest?.id !== input.messageId) return false
    if (conversation.status === "open") {
      await transaction
        .update(supportConversations)
        .set({ status: "ai_active" })
        .where(
          and(
            eq(supportConversations.organizationId, input.organizationId),
            eq(supportConversations.id, input.supportConversationId),
            isNull(supportConversations.resolvedAt)
          )
        )
    }
    return true
  })
}

async function createAiReply(
  input: {
    organizationId: string
    supportConversationId: string
    messageId: string
  },
  state: InboundMessageState,
  body: string
) {
  return database.db.transaction(async (transaction) => {
    const [current] = await transaction
      .select({ status: supportConversations.status })
      .from(supportConversations)
      .where(
        and(
          eq(supportConversations.organizationId, input.organizationId),
          eq(supportConversations.id, input.supportConversationId)
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
          eq(messages.organizationId, input.organizationId),
          eq(messages.supportConversationId, input.supportConversationId),
          eq(messages.direction, "inbound"),
          eq(messages.senderType, "contact")
        )
      )
      .orderBy(desc(messages.occurredAt), desc(messages.id))
      .limit(1)
    if (latest?.id !== input.messageId) return null
    const [message] = await transaction
      .insert(messages)
      .values({
        id: createId(),
        organizationId: input.organizationId,
        supportConversationId: input.supportConversationId,
        channelConnectionId: state.channelConnectionId,
        direction: "outbound",
        senderType: "ai",
        contentType: "text",
        body,
        status: "pending",
        replyToMessageId: input.messageId,
        occurredAt: new Date(),
      })
      .onConflictDoNothing()
      .returning({ id: messages.id })
    return message ?? null
  })
}

async function handoff(
  input: {
    organizationId: string
    supportConversationId: string
    messageId: string
  },
  state: InboundMessageState,
  reason: SupportConversationHandoffReason,
  actorType: "ai" | "system",
  notice: { customerMessage: string; summary: string | null }
): Promise<void> {
  const occurredAt = new Date()
  const created = await database.db.transaction(async (transaction) => {
    const transitioned = await transaction
      .update(supportConversations)
      .set({
        status: "human_required",
        handoffReason: reason,
        handoffSummary: notice.summary,
        lastActivityAt: sql`greatest(${supportConversations.lastActivityAt}, ${occurredAt})`,
      })
      .where(
        and(
          eq(supportConversations.organizationId, input.organizationId),
          eq(supportConversations.id, input.supportConversationId),
          isNull(supportConversations.resolvedAt),
          ne(supportConversations.status, "human_required")
        )
      )
      .returning({ id: supportConversations.id })
    if (transitioned.length === 0) return null
    await transaction.insert(auditEvents).values({
      organizationId: input.organizationId,
      eventType: "support_conversation.human_required",
      actorType,
      subjectType: "support_conversation",
      subjectId: input.supportConversationId,
      data: { messageId: input.messageId, reason },
      occurredAt,
    })
    const [message] = await transaction
      .insert(messages)
      .values({
        id: createId(),
        organizationId: input.organizationId,
        supportConversationId: input.supportConversationId,
        channelConnectionId: state.channelConnectionId,
        direction: "outbound",
        senderType: "ai",
        contentType: "text",
        body: notice.customerMessage,
        status: "pending",
        replyToMessageId: input.messageId,
        occurredAt,
      })
      .returning({ id: messages.id })
    return message ?? null
  })
  if (!created) return
  await enqueueOutboundMessage({
    organizationId: input.organizationId,
    channelConnectionId: state.channelConnectionId,
    supportConversationId: input.supportConversationId,
    messageId: created.id,
  })
}

async function enqueueOutboundMessage(input: {
  organizationId: string
  channelConnectionId: string
  supportConversationId: string
  messageId: string
}): Promise<void> {
  await supportConversationsQueue.add(
    supportConversationJobNames.sendOutboundMessage,
    input,
    {
      jobId: `${supportConversationJobNames.sendOutboundMessage}--${input.messageId}`,
    }
  )
}
