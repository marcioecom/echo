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
  createChannelAdapterRegistry,
  type ChannelAdapterRegistry,
  type SendResult,
} from "@workspace/messaging"
import type { Job } from "bullmq"
import { and, eq, inArray } from "drizzle-orm"

import { env } from "../../config/env"
import { database } from "../../lib/db"
import { redisConnection } from "../../lib/redis"

const credentialsCipher = new ChannelCredentialsCipher({
  encryptionKey: env.CHANNEL_CREDENTIALS_ENCRYPTION_KEY,
  keyVersion: env.CHANNEL_CREDENTIALS_KEY_VERSION,
})

const defaultAdapters = createChannelAdapterRegistry(env.PUBLIC_API_URL)

export function handleSendOutboundMessage(job: Job): Promise<void> {
  return deliverOutboundMessage(job, defaultAdapters)
}

export async function deliverOutboundMessage(
  job: Job,
  adapters: ChannelAdapterRegistry
): Promise<void> {
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

  const adapter = adapters.adapterFor(outbound.provider)
  if (!adapter) {
    await markOutboundMessageFailed({
      ...payload,
      reason: "provider_rejected",
    })
    return
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
      provider: outbound.provider,
    }
  )

  let result: SendResult
  try {
    result = await adapter.send(
      {
        organizationId: payload.organizationId,
        channelConnectionId: payload.channelConnectionId,
        fromAddress: outbound.channelAddress,
        externalAccountId: outbound.externalAccountId,
        authToken,
      },
      outbound.contactAddress,
      { type: "text", body: outbound.body }
    )
  } catch (error) {
    if (isFinalAttempt(job)) {
      await markOutboundMessageFailed({
        ...payload,
        reason: "retry_exhausted",
      })
      return
    }
    throw error
  }

  if (result.ok) {
    await database.db
      .update(messages)
      .set({ externalMessageId: result.externalMessageId, status: "sent" })
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
    return
  }

  if (!result.retryable || isFinalAttempt(job)) {
    await markOutboundMessageFailed({
      ...payload,
      reason: result.retryable ? "retry_exhausted" : "provider_rejected",
      providerCode: result.providerCode,
    })
    return
  }

  throw new Error(`Retryable outbound send failure: ${result.code}`)
}

function isFinalAttempt(job: Job): boolean {
  return job.attemptsMade + 1 >= (job.opts.attempts ?? 1)
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
      provider: channelConnectionProviderBindings.provider,
      externalAccountId: channelConnectionProviderBindings.externalAccountId,
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
        )
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
        inArray(messages.senderType, ["operator", "ai"]),
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
  reason: "provider_rejected" | "retry_exhausted"
  providerCode?: number
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

    await transaction.insert(auditEvents).values({
      organizationId: input.organizationId,
      eventType: "message.outbound_delivery_failed",
      actorType: "system",
      subjectType: "message",
      subjectId: input.messageId,
      data: {
        reason: input.reason,
        ...(typeof input.providerCode === "number"
          ? { providerCode: input.providerCode }
          : {}),
      },
    })
  })

  await publishInboxEvent(redisConnection, input.organizationId, {
    type: "support_conversation.updated",
    conversationId: input.supportConversationId,
  })
}
