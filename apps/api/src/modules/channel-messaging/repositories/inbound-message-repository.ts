import {
  auditEvents,
  channelConnections,
  channelIdentities,
  contacts,
  messages,
  organizations,
  supportConversations,
} from "@workspace/db/schema"
import type { Database } from "@workspace/db"
import { createId } from "@workspace/domain"
import { and, eq, isNull, sql } from "drizzle-orm"

import { database } from "@/lib/db"
import type { NormalizedInboundMessage } from "@workspace/domain"

import type { IngestedInboundMessage } from "../types"

export class InboundMessageRepository {
  constructor(private readonly db: Database = database.db) {}

  async ingest(input: NormalizedInboundMessage): Promise<IngestedInboundMessage> {
    return this.db.transaction(async (transaction) => {
      const [activeConnection] = await transaction
        .select({ id: channelConnections.id })
        .from(channelConnections)
        .innerJoin(
          organizations,
          eq(organizations.id, channelConnections.organizationId)
        )
        .where(
          and(
            eq(channelConnections.organizationId, input.organizationId),
            eq(channelConnections.id, input.channelConnectionId),
            eq(channelConnections.channelType, input.channelType),
            eq(channelConnections.status, "active"),
            eq(organizations.status, "active")
          )
        )
        .limit(1)
        .for("share")

      if (!activeConnection) {
        throw new Error("Organization or Channel Connection is not active")
      }

      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`inbound-message:provider-event:${input.organizationId}:${input.channelConnectionId}:${input.externalMessageId}`}, 0))`
      )

      const [existingMessage] = await transaction
        .select({
          contactId: channelIdentities.contactId,
          channelIdentityId: supportConversations.channelIdentityId,
          supportConversationId: messages.supportConversationId,
          messageId: messages.id,
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
            eq(messages.organizationId, input.organizationId),
            eq(messages.channelConnectionId, input.channelConnectionId),
            eq(messages.externalMessageId, input.externalMessageId)
          )
        )
        .limit(1)

      if (existingMessage) {
        return {
          organizationId: input.organizationId,
          channelConnectionId: input.channelConnectionId,
          ...existingMessage,
          duplicate: true,
        }
      }

      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`inbound-message:channel-identity:${input.organizationId}:${input.channelType}:${input.senderAddress}`}, 0))`
      )

      let [identity] = await transaction
        .select({
          id: channelIdentities.id,
          contactId: channelIdentities.contactId,
        })
        .from(channelIdentities)
        .where(
          and(
            eq(channelIdentities.organizationId, input.organizationId),
            eq(channelIdentities.channelType, input.channelType),
            eq(channelIdentities.address, input.senderAddress)
          )
        )
        .limit(1)

      if (!identity) {
        const contactId = createId()
        const channelIdentityId = createId()
        await transaction.insert(contacts).values({
          id: contactId,
          organizationId: input.organizationId,
          displayName: input.senderDisplayName,
        })
        await transaction.insert(channelIdentities).values({
          id: channelIdentityId,
          organizationId: input.organizationId,
          contactId,
          channelType: input.channelType,
          address: input.senderAddress,
        })
        identity = { id: channelIdentityId, contactId }
      }

      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`inbound-message:conversation-pair:${input.organizationId}:${identity.id}:${input.channelConnectionId}`}, 0))`
      )

      let [conversation] = await transaction
        .select({ id: supportConversations.id })
        .from(supportConversations)
        .where(
          and(
            eq(supportConversations.organizationId, input.organizationId),
            eq(supportConversations.channelIdentityId, identity.id),
            eq(
              supportConversations.channelConnectionId,
              input.channelConnectionId
            ),
            isNull(supportConversations.resolvedAt)
          )
        )
        .limit(1)
        .for("update")

      if (!conversation) {
        const supportConversationId = createId()
        await transaction.insert(supportConversations).values({
          id: supportConversationId,
          organizationId: input.organizationId,
          channelIdentityId: identity.id,
          channelConnectionId: input.channelConnectionId,
          status: "open",
          lastActivityAt: input.receivedAt,
        })
        conversation = { id: supportConversationId }
      }

      const messageId = createId()
      await transaction.insert(messages).values({
        id: messageId,
        organizationId: input.organizationId,
        supportConversationId: conversation.id,
        channelConnectionId: input.channelConnectionId,
        direction: "inbound",
        senderType: "contact",
        contentType: input.content.type,
        body: input.content.type === "text" ? input.content.body : null,
        status: "received",
        externalMessageId: input.externalMessageId,
        occurredAt: input.receivedAt,
      })

      await transaction
        .update(supportConversations)
        .set({
          lastActivityAt: sql`greatest(${supportConversations.lastActivityAt}, ${input.receivedAt})`,
        })
        .where(
          and(
            eq(supportConversations.organizationId, input.organizationId),
            eq(supportConversations.id, conversation.id),
            eq(
              supportConversations.channelConnectionId,
              input.channelConnectionId
            ),
            isNull(supportConversations.resolvedAt)
          )
        )

      if (input.content.type === "unsupported") {
        await transaction.insert(auditEvents).values({
          organizationId: input.organizationId,
          eventType: "message.unsupported_content",
          actorType: "system",
          subjectType: "message",
          subjectId: messageId,
          data: { mediaKind: input.content.mediaKind ?? "unknown" },
          occurredAt: input.receivedAt,
        })
      }

      return {
        organizationId: input.organizationId,
        channelConnectionId: input.channelConnectionId,
        contactId: identity.contactId,
        channelIdentityId: identity.id,
        supportConversationId: conversation.id,
        messageId,
        duplicate: false,
      }
    })
  }
}

export const inboundMessageRepository = new InboundMessageRepository()
