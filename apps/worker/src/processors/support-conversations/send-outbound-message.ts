import {
  auditEvents,
  channelConnectionProviderBindings,
  channelConnections,
  channelIdentities,
  messages,
  organizations,
  supportConversations,
} from "@workspace/db/schema"
import {
  publishInboxEvent,
  sendOutboundMessageJobSchema,
} from "@workspace/jobs"
import {
  ChannelCredentialsCipher,
  isPermanentTwilioSendError,
  TwilioChannelProvider,
} from "@workspace/messaging"
import type { Job } from "bullmq"
import { and, eq } from "drizzle-orm"

import { env } from "../../config/env"
import { database } from "../../lib/db"
import { redisConnection } from "../../lib/redis"

const credentialsCipher = new ChannelCredentialsCipher({
  encryptionKey: env.CHANNEL_CREDENTIALS_ENCRYPTION_KEY,
  keyVersion: env.CHANNEL_CREDENTIALS_KEY_VERSION,
})

export async function handleSendOutboundMessage(job: Job): Promise<void> {
  const payload = sendOutboundMessageJobSchema.parse(job.data)
  const outbound = await loadOutboundMessage(payload)

  if (!outbound) {
    throw new Error("Outbound Message job IDs do not identify one tenant state")
  }
  if (
    outbound.status === "sent" ||
    outbound.status === "delivered" ||
    outbound.status === "read" ||
    outbound.status === "failed"
  ) {
    return
  }
  if (!outbound.body) {
    throw new Error("Outbound text Message has no body")
  }

  const authToken = credentialsCipher.decrypt(
    {
      ciphertext: outbound.ciphertext,
      nonce: outbound.nonce,
      authTag: outbound.authTag,
      keyVersion: outbound.keyVersion,
    },
    {
      organizationId: payload.organizationId,
      channelConnectionId: payload.channelConnectionId,
      provider: "twilio",
    }
  )

  const provider = new TwilioChannelProvider(outbound.accountSid, authToken)
  try {
    const sent = await provider.sendWhatsAppTextMessage({
      from: outbound.channelAddress,
      to: outbound.contactAddress,
      body: outbound.body,
      statusCallbackUrl: new URL(
        "/webhooks/twilio/whatsapp/status",
        env.PUBLIC_API_URL
      ).toString(),
    })

    await database.db
      .update(messages)
      .set({ externalMessageId: sent.externalMessageId, status: "sent" })
      .where(
        and(
          eq(messages.organizationId, payload.organizationId),
          eq(messages.id, payload.messageId),
          eq(messages.channelConnectionId, payload.channelConnectionId),
          eq(messages.status, "pending")
        )
      )

    await publishInboxEvent(redisConnection, payload.organizationId, {
      type: "support_conversation.updated",
      conversationId: payload.supportConversationId,
    })
  } catch (error) {
    const finalAttempt =
      job.attemptsMade + 1 >= (job.opts.attempts ?? 1)
    if (isPermanentTwilioSendError(error) || finalAttempt) {
      await markOutboundMessageFailed({
        ...payload,
        error,
        reason: isPermanentTwilioSendError(error)
          ? "provider_rejected"
          : "retry_exhausted",
      })
      return
    }
    throw error
  }
}

async function loadOutboundMessage(input: {
  organizationId: string
  channelConnectionId: string
  supportConversationId: string
  messageId: string
}) {
  const [outbound] = await database.db
    .select({
      status: messages.status,
      body: messages.body,
      contactAddress: channelIdentities.address,
      channelAddress: channelConnections.address,
      accountSid: channelConnectionProviderBindings.externalAccountId,
      ciphertext: channelConnectionProviderBindings.credentialsCiphertext,
      nonce: channelConnectionProviderBindings.credentialsNonce,
      authTag: channelConnectionProviderBindings.credentialsAuthTag,
      keyVersion: channelConnectionProviderBindings.credentialsKeyVersion,
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
        eq(channelIdentities.organizationId, supportConversations.organizationId),
        eq(channelIdentities.id, supportConversations.channelIdentityId)
      )
    )
    .innerJoin(
      channelConnections,
      and(
        eq(channelConnections.organizationId, messages.organizationId),
        eq(channelConnections.id, messages.channelConnectionId)
      )
    )
    .innerJoin(
      channelConnectionProviderBindings,
      and(
        eq(
          channelConnectionProviderBindings.organizationId,
          messages.organizationId
        ),
        eq(
          channelConnectionProviderBindings.channelConnectionId,
          messages.channelConnectionId
        ),
        eq(channelConnectionProviderBindings.provider, "twilio")
      )
    )
    .innerJoin(
      organizations,
      eq(organizations.id, messages.organizationId)
    )
    .where(
      and(
        eq(messages.organizationId, input.organizationId),
        eq(messages.id, input.messageId),
        eq(messages.supportConversationId, input.supportConversationId),
        eq(messages.channelConnectionId, input.channelConnectionId),
        eq(messages.direction, "outbound"),
        eq(messages.senderType, "operator"),
        eq(channelConnections.status, "active"),
        eq(organizations.status, "active")
      )
    )
    .limit(1)

  if (!outbound?.channelAddress) return null
  return { ...outbound, channelAddress: outbound.channelAddress }
}

async function markOutboundMessageFailed(input: {
  organizationId: string
  channelConnectionId: string
  supportConversationId: string
  messageId: string
  error: unknown
  reason: "provider_rejected" | "retry_exhausted"
}): Promise<void> {
  await database.db.transaction(async (transaction) => {
    const updated = await transaction
      .update(messages)
      .set({ status: "failed" })
      .where(
        and(
          eq(messages.organizationId, input.organizationId),
          eq(messages.id, input.messageId),
          eq(messages.channelConnectionId, input.channelConnectionId),
          eq(messages.status, "pending")
        )
      )
      .returning({ id: messages.id })
    if (updated.length === 0) return

    const providerCode =
      typeof input.error === "object" && input.error !== null
        ? (input.error as { code?: unknown }).code
        : undefined
    await transaction.insert(auditEvents).values({
      organizationId: input.organizationId,
      eventType: "message.outbound_delivery_failed",
      actorType: "system",
      subjectType: "message",
      subjectId: input.messageId,
      data: {
        reason: input.reason,
        ...(typeof providerCode === "number" ? { providerCode } : {}),
      },
    })
  })

  await publishInboxEvent(redisConnection, input.organizationId, {
    type: "support_conversation.updated",
    conversationId: input.supportConversationId,
  })
}
