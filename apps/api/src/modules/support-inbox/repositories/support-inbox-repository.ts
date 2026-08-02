import type { Database } from "@workspace/db"
import {
  channelConnections,
  channelIdentities,
  contacts,
  messages,
  supportConversations,
  users,
} from "@workspace/db/schema"
import type {
  ActorType,
  MessageContentType,
  SupportConversationStatus,
} from "@workspace/domain"
import { and, asc, desc, eq, lt, or, sql } from "drizzle-orm"

import { database } from "@/lib/db"
import type {
  SupportInboxConversation,
  SupportInboxConversationDetail,
  SupportInboxCursor,
} from "../types"

export class SupportInboxRepository {
  constructor(private readonly db: Database = database.db) { }

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
      })
      .from(messages)
      .leftJoin(users, eq(users.id, messages.operatorUserId))
      .where(
        and(
          eq(messages.organizationId, input.organizationId),
          eq(messages.supportConversationId, input.conversationId)
        )
      )
      .orderBy(asc(messages.occurredAt), asc(messages.id))

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
      },
      messages: timeline,
    }
  }
}

export const supportInboxRepository = new SupportInboxRepository()
