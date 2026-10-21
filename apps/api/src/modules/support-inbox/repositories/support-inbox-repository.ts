import type {
  SupportInboxConversation,
  SupportInboxConversationDetail,
  SupportInboxCursor,
} from "../types"
import type { Database } from "@workspace/db"
import type {
  ActorType,
  MessageContentType,
  MessageTranscriptionStatus,
  SupportConversationHandoffReason,
  SupportConversationStatus,
} from "@workspace/domain"

import {
  auditEvents,
  channelConnections,
  channelIdentities,
  contacts,
  messageMedia,
  messages,
  supportConversations,
  users,
} from "@workspace/db/schema"
import {
  createId,
  supportConversationHandoffReasonSchema,
} from "@workspace/domain"
import { and, asc, desc, eq, lt, or, sql } from "drizzle-orm"

import { database } from "@/lib/db"

export class SupportInboxRepository {
  constructor(private readonly db: Database = database.db) {}

  async list(input: {
    organizationId: string
    status?: SupportConversationStatus
    cursor?: SupportInboxCursor
    limit: number
  }): Promise<{ items: SupportInboxConversation[]; hasMore: boolean }> {
    const cursorCondition = input.cursor
      ? or(
          lt(supportConversations.lastActivityAt, input.cursor.lastActivityAt),
          and(
            eq(
              supportConversations.lastActivityAt,
              input.cursor.lastActivityAt
            ),
            lt(supportConversations.id, input.cursor.id)
          )
        )
      : undefined

    const rows = await this.db
      .select({
        id: supportConversations.id,
        status: supportConversations.status,
        displayName: contacts.displayName,
        address: channelIdentities.address,
        channelType: channelIdentities.channelType,
        lastActivityAt: supportConversations.lastActivityAt,
        lastMessageBody: sql<string | null>`(
          select inbox_message.body
          from messages as inbox_message
          where inbox_message.organization_id = ${input.organizationId}
            and inbox_message.support_conversation_id = ${supportConversations.id}
          order by inbox_message.occurred_at desc, inbox_message.id desc
          limit 1
        )`,
        lastMessageSenderType: sql<ActorType | null>`(
          select inbox_message.sender_type
          from messages as inbox_message
          where inbox_message.organization_id = ${input.organizationId}
            and inbox_message.support_conversation_id = ${supportConversations.id}
          order by inbox_message.occurred_at desc, inbox_message.id desc
          limit 1
        )`,
        lastMessageContentType: sql<MessageContentType | null>`(
          select inbox_message.content_type
          from messages as inbox_message
          where inbox_message.organization_id = ${input.organizationId}
            and inbox_message.support_conversation_id = ${supportConversations.id}
          order by inbox_message.occurred_at desc, inbox_message.id desc
          limit 1
        )`,
        lastMessageTranscriptStatus: sql<MessageTranscriptionStatus | null>`(
          select inbox_media.transcript_status
          from messages as inbox_message
          inner join message_media as inbox_media
            on inbox_media.organization_id = inbox_message.organization_id
            and inbox_media.message_id = inbox_message.id
          where inbox_message.organization_id = ${input.organizationId}
            and inbox_message.support_conversation_id = ${supportConversations.id}
          order by inbox_message.occurred_at desc, inbox_message.id desc
          limit 1
        )`,
      })
      .from(supportConversations)
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
      .innerJoin(
        contacts,
        and(
          eq(contacts.organizationId, channelIdentities.organizationId),
          eq(contacts.id, channelIdentities.contactId)
        )
      )
      .where(
        and(
          eq(supportConversations.organizationId, input.organizationId),
          input.status
            ? eq(supportConversations.status, input.status)
            : undefined,
          cursorCondition
        )
      )
      .orderBy(
        desc(supportConversations.lastActivityAt),
        desc(supportConversations.id)
      )
      .limit(input.limit + 1)

    const hasMore = rows.length > input.limit
    return {
      items: rows.slice(0, input.limit).map((row) => ({
        id: row.id,
        status: row.status,
        contact: {
          displayName: row.displayName,
          address: row.address,
          channelType: row.channelType,
        },
        lastActivityAt: row.lastActivityAt,
        lastMessage:
          row.lastMessageSenderType && row.lastMessageContentType
            ? {
                preview:
                  row.lastMessageContentType === "unsupported"
                    ? "Unsupported attachment"
                    : (row.lastMessageBody ?? ""),
                senderType: row.lastMessageSenderType,
                contentType: row.lastMessageContentType,
                transcriptStatus: row.lastMessageTranscriptStatus,
              }
            : null,
      })),
      hasMore,
    }
  }

  async findDetail(input: {
    organizationId: string
    conversationId: string
  }): Promise<SupportInboxConversationDetail | null> {
    const [conversation] = await this.db
      .select({
        id: supportConversations.id,
        status: supportConversations.status,
        displayName: contacts.displayName,
        identityAddress: channelIdentities.address,
        channelType: channelIdentities.channelType,
        channelConnectionId: channelConnections.id,
        channelConnectionName: channelConnections.name,
        channelConnectionAddress: channelConnections.address,
        lastActivityAt: supportConversations.lastActivityAt,
        resolvedAt: supportConversations.resolvedAt,
        handoffReason: supportConversations.handoffReason,
        handoffSummary: supportConversations.handoffSummary,
      })
      .from(supportConversations)
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
      .innerJoin(
        contacts,
        and(
          eq(contacts.organizationId, channelIdentities.organizationId),
          eq(contacts.id, channelIdentities.contactId)
        )
      )
      .innerJoin(
        channelConnections,
        and(
          eq(
            channelConnections.organizationId,
            supportConversations.organizationId
          ),
          eq(channelConnections.id, supportConversations.channelConnectionId)
        )
      )
      .where(
        and(
          eq(supportConversations.organizationId, input.organizationId),
          eq(supportConversations.id, input.conversationId)
        )
      )
      .limit(1)

    if (!conversation) return null

    const timeline = await this.db
      .select({
        id: messages.id,
        direction: messages.direction,
        senderType: messages.senderType,
        contentType: messages.contentType,
        body: messages.body,
        status: messages.status,
        occurredAt: messages.occurredAt,
        operatorName: users.name,
        mediaMimeType: messageMedia.mimeType,
        mediaDurationMs: messageMedia.durationMs,
        mediaDownloadStatus: messageMedia.downloadStatus,
        mediaTranscriptStatus: messageMedia.transcriptStatus,
      })
      .from(messages)
      .leftJoin(users, eq(users.id, messages.operatorUserId))
      .leftJoin(
        messageMedia,
        and(
          eq(messageMedia.organizationId, messages.organizationId),
          eq(messageMedia.messageId, messages.id)
        )
      )
      .where(
        and(
          eq(messages.organizationId, input.organizationId),
          eq(messages.supportConversationId, input.conversationId)
        )
      )
      .orderBy(asc(messages.occurredAt), asc(messages.id))

    const handoffEvents = await this.db
      .select({
        id: auditEvents.id,
        actorType: auditEvents.actorType,
        occurredAt: auditEvents.occurredAt,
        data: auditEvents.data,
      })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.organizationId, input.organizationId),
          eq(auditEvents.subjectType, "support_conversation"),
          eq(auditEvents.subjectId, input.conversationId),
          eq(auditEvents.eventType, "support_conversation.human_required")
        )
      )
      .orderBy(asc(auditEvents.occurredAt), asc(auditEvents.id))

    return {
      conversation: {
        id: conversation.id,
        status: conversation.status,
        contact: {
          displayName: conversation.displayName,
          address: conversation.identityAddress,
          channelType: conversation.channelType,
        },
        channelConnection: {
          id: conversation.channelConnectionId,
          name: conversation.channelConnectionName,
          address: conversation.channelConnectionAddress,
        },
        lastActivityAt: conversation.lastActivityAt,
        resolvedAt: conversation.resolvedAt,
        handoffReason: conversation.handoffReason,
        handoffSummary: conversation.handoffSummary,
      },
      events: handoffEvents.flatMap((event) => {
        const reason = readHandoffReason(event.data)
        if (!reason) return []
        return [
          {
            id: event.id,
            actorType: event.actorType,
            occurredAt: event.occurredAt,
            reason,
          },
        ]
      }),
      messages: timeline.map(
        ({
          mediaMimeType,
          mediaDurationMs,
          mediaDownloadStatus,
          mediaTranscriptStatus,
          ...message
        }) => ({
          ...message,
          media:
            mediaMimeType && mediaDownloadStatus && mediaTranscriptStatus
              ? {
                  mimeType: mediaMimeType,
                  durationMs: mediaDurationMs,
                  downloadStatus: mediaDownloadStatus,
                  transcriptStatus: mediaTranscriptStatus,
                }
              : null,
        })
      ),
    }
  }

  async findMessageMedia(input: {
    organizationId: string
    conversationId: string
    messageId: string
  }): Promise<{
    objectKey: string
    mimeType: string
    durationMs: number | null
  } | null> {
    const [row] = await this.db
      .select({
        objectKey: messageMedia.objectKey,
        downloadStatus: messageMedia.downloadStatus,
        mimeType: messageMedia.mimeType,
        durationMs: messageMedia.durationMs,
      })
      .from(messages)
      .innerJoin(
        messageMedia,
        and(
          eq(messageMedia.organizationId, messages.organizationId),
          eq(messageMedia.messageId, messages.id)
        )
      )
      .where(
        and(
          eq(messages.organizationId, input.organizationId),
          eq(messages.supportConversationId, input.conversationId),
          eq(messages.id, input.messageId),
          eq(messages.contentType, "audio")
        )
      )
      .limit(1)

    if (!row || row.downloadStatus !== "stored" || !row.objectKey) return null

    return {
      objectKey: row.objectKey,
      mimeType: row.mimeType,
      durationMs: row.durationMs,
    }
  }

  async createOperatorReply(input: {
    organizationId: string
    conversationId: string
    operatorUserId: string
    body: string
    occurredAt: Date
  }): Promise<
    | { type: "not_found" }
    | { type: "resolved" }
    | {
        type: "created"
        messageId: string
        channelConnectionId: string
        supportConversationId: string
      }
  > {
    return this.db.transaction(async (transaction) => {
      const [conversation] = await transaction
        .select({
          id: supportConversations.id,
          channelConnectionId: supportConversations.channelConnectionId,
          status: supportConversations.status,
        })
        .from(supportConversations)
        .where(
          and(
            eq(supportConversations.organizationId, input.organizationId),
            eq(supportConversations.id, input.conversationId)
          )
        )
        .limit(1)
        .for("update")

      if (!conversation) return { type: "not_found" }
      if (conversation.status === "resolved") return { type: "resolved" }

      const messageId = createId()
      await transaction.insert(messages).values({
        id: messageId,
        organizationId: input.organizationId,
        supportConversationId: conversation.id,
        channelConnectionId: conversation.channelConnectionId,
        direction: "outbound",
        senderType: "operator",
        operatorUserId: input.operatorUserId,
        contentType: "text",
        body: input.body,
        status: "pending",
        occurredAt: input.occurredAt,
      })

      await transaction
        .update(supportConversations)
        .set({
          lastActivityAt: sql`greatest(${supportConversations.lastActivityAt}, ${input.occurredAt})`,
        })
        .where(
          and(
            eq(supportConversations.organizationId, input.organizationId),
            eq(supportConversations.id, conversation.id),
            eq(
              supportConversations.channelConnectionId,
              conversation.channelConnectionId
            )
          )
        )

      return {
        type: "created",
        messageId,
        channelConnectionId: conversation.channelConnectionId,
        supportConversationId: conversation.id,
      }
    })
  }
}

function readHandoffReason(
  data: Record<string, unknown>
): SupportConversationHandoffReason | null {
  const parsed = supportConversationHandoffReasonSchema.safeParse(data.reason)
  return parsed.success ? parsed.data : null
}

export const supportInboxRepository = new SupportInboxRepository()
