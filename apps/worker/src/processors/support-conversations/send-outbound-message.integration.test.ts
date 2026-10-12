import { resolve } from "node:path"

import { PostgreSqlContainer } from "@testcontainers/postgresql"
import { createDatabase } from "@workspace/db"
import {
  auditEvents,
  channelConnectionProviderBindings,
  channelConnections,
  channelIdentities,
  contacts,
  messages,
  organizations,
  supportConversations,
} from "@workspace/db/schema"
import { createId, type ChannelProvider } from "@workspace/domain"
import {
  ChannelCredentialsCipher,
  type ChannelAdapter,
  type ChannelAdapterRegistry,
  type SendResult,
} from "@workspace/messaging"
import type { Job } from "bullmq"
import { and, eq, sql } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const { databaseRef, encryptionKey, publish } = vi.hoisted(() => ({
  databaseRef: { current: {} as object },
  encryptionKey: Buffer.alloc(32, 9).toString("base64"),
  publish: vi.fn(),
}))

vi.mock("../../lib/db", () => ({
  database: new Proxy(
    {},
    {
      get: (_target, property) => Reflect.get(databaseRef.current, property),
    }
  ),
}))
vi.mock("../../config/env", () => ({
  env: {
    PUBLIC_API_URL: "https://api.example.test",
    CHANNEL_CREDENTIALS_ENCRYPTION_KEY: encryptionKey,
    CHANNEL_CREDENTIALS_KEY_VERSION: "v1",
  },
}))
vi.mock("../../lib/redis", () => ({
  redisConnection: { publish },
}))

import { deliverOutboundMessage } from "./send-outbound-message"

const cipher = new ChannelCredentialsCipher({
  encryptionKey,
  keyVersion: "v1",
})

describe("send outbound message", () => {
  const container = new PostgreSqlContainer("pgvector/pgvector:pg18")
  let database: ReturnType<typeof createDatabase>
  let stop: () => Promise<void>
  let phone = 5511900000000

  beforeAll(async () => {
    const postgres = await container.start()
    stop = () => postgres.stop().then(() => undefined)
    database = createDatabase(postgres.getConnectionUri(), 10_000)
    databaseRef.current = database
    await database.db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`)
    await migrate(database.db, {
      migrationsFolder: resolve(process.cwd(), "../../packages/db/migrations"),
    })
  }, 60_000)

  afterAll(async () => {
    await Promise.allSettled([database?.close(), stop?.()])
  })

  beforeEach(() => {
    publish.mockReset()
  })

  function nextPhone(): string {
    phone += 1
    return `+${phone}`
  }

  async function createPendingOutbound(provider: ChannelProvider) {
    const organizationId = createId()
    const contactId = createId()
    const channelIdentityId = createId()
    const channelConnectionId = createId()
    const supportConversationId = createId()
    const inboundMessageId = createId()
    const messageId = createId()
    const contactAddress = nextPhone()
    const channelAddress = nextPhone()
    const encrypted = cipher.encrypt("auth-token", {
      organizationId,
      channelConnectionId,
      provider,
    })

    await database.db.insert(organizations).values({
      id: organizationId,
      name: organizationId,
      slug: organizationId.toLowerCase(),
      status: "active",
      createdAt: new Date(),
    })
    await database.db.insert(contacts).values({ id: contactId, organizationId })
    await database.db.insert(channelIdentities).values({
      id: channelIdentityId,
      organizationId,
      contactId,
      channelType: "whatsapp",
      address: contactAddress,
    })
    await database.db.insert(channelConnections).values({
      id: channelConnectionId,
      organizationId,
      channelType: "whatsapp",
      name: "Support",
      address: channelAddress,
      status: "active",
    })
    await database.db.insert(channelConnectionProviderBindings).values({
      organizationId,
      channelConnectionId,
      provider,
      externalAccountId: "AC11111111111111111111111111111111",
      externalSenderId: "XE11111111111111111111111111111111",
      routingAddress: channelAddress,
      credentialsCiphertext: encrypted.ciphertext,
      credentialsNonce: encrypted.nonce,
      credentialsAuthTag: encrypted.authTag,
      credentialsKeyVersion: encrypted.keyVersion,
    })
    await database.db.insert(supportConversations).values({
      id: supportConversationId,
      organizationId,
      channelIdentityId,
      channelConnectionId,
      status: "open",
    })
    await database.db.insert(messages).values({
      id: inboundMessageId,
      organizationId,
      supportConversationId,
      channelConnectionId,
      direction: "inbound",
      senderType: "contact",
      contentType: "text",
      body: "Help",
      status: "received",
      occurredAt: new Date(),
    })
    await database.db.insert(messages).values({
      id: messageId,
      organizationId,
      supportConversationId,
      channelConnectionId,
      direction: "outbound",
      senderType: "ai",
      contentType: "text",
      body: "Reply",
      status: "pending",
      replyToMessageId: inboundMessageId,
      occurredAt: new Date(),
    })

    return {
      organizationId,
      channelConnectionId,
      supportConversationId,
      messageId,
      contactAddress,
      channelAddress,
    }
  }

  function job(
    payload: {
      organizationId: string
      channelConnectionId: string
      supportConversationId: string
      messageId: string
    },
    attemptsMade = 0
  ): Job {
    return {
      data: payload,
      attemptsMade,
      opts: { attempts: 4 },
    } as Job
  }

  function registryFor(
    send: ChannelAdapter["send"]
  ): { registry: ChannelAdapterRegistry; providers: ChannelProvider[] } {
    const providers: ChannelProvider[] = []
    return {
      providers,
      registry: {
        adapterFor(provider) {
          providers.push(provider)
          const adapter: ChannelAdapter = {
            provider,
            delivery: provider === "twilio" ? "webhook" : "session",
            send,
            health: async () => ({ state: "connected" }),
          }
          return adapter
        },
      },
    }
  }

  async function messageStatus(messageId: string) {
    const [message] = await database.db
      .select({
        status: messages.status,
        externalMessageId: messages.externalMessageId,
      })
      .from(messages)
      .where(eq(messages.id, messageId))
    return message
  }

  it("sends through the adapter for the connection provider", async () => {
    const state = await createPendingOutbound("twilio")
    const { registry, providers } = registryFor(async (ctx, to, content) => {
      expect(ctx.fromAddress).toBe(state.channelAddress)
      expect(ctx.authToken).toBe("auth-token")
      expect(to).toBe(state.contactAddress)
      expect(content).toEqual({ type: "text", body: "Reply" })
      return { ok: true, externalMessageId: "SM11111111111111111111111111111111" }
    })

    await deliverOutboundMessage(job(state), registry)

    expect(providers).toEqual(["twilio"])
    await expect(messageStatus(state.messageId)).resolves.toEqual({
      status: "sent",
      externalMessageId: "SM11111111111111111111111111111111",
    })
    expect(publish).toHaveBeenCalledWith(
      `inbox-events:${state.organizationId}`,
      JSON.stringify({
        type: "support_conversation.updated",
        conversationId: state.supportConversationId,
      })
    )
  })

  it("resolves a non-Twilio provider from the binding", async () => {
    const state = await createPendingOutbound("baileys")
    const { registry, providers } = registryFor(async () => ({
      ok: true,
      externalMessageId: "baileys-1",
    }))

    await deliverOutboundMessage(job(state), registry)

    expect(providers).toEqual(["baileys"])
    await expect(messageStatus(state.messageId)).resolves.toMatchObject({
      status: "sent",
      externalMessageId: "baileys-1",
    })
  })

  it("marks a permanent provider rejection as failed without retrying", async () => {
    const state = await createPendingOutbound("twilio")
    const send = vi.fn(
      async (): Promise<SendResult> => ({
        ok: false,
        retryable: false,
        code: "21610",
        providerCode: 21610,
      })
    )
    const { registry } = registryFor(send)

    await deliverOutboundMessage(job(state, 0), registry)

    expect(send).toHaveBeenCalledOnce()
    await expect(messageStatus(state.messageId)).resolves.toMatchObject({
      status: "failed",
    })
    const [event] = await database.db
      .select({ data: auditEvents.data })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.organizationId, state.organizationId),
          eq(auditEvents.subjectId, state.messageId)
        )
      )
    expect(event?.data).toEqual({
      reason: "provider_rejected",
      providerCode: 21610,
    })
  })

  it("retries a retryable failure and fails the message on the last attempt", async () => {
    const retryState = await createPendingOutbound("twilio")
    const retrySend = vi.fn(
      async (): Promise<SendResult> => ({
        ok: false,
        retryable: true,
        code: "20429",
        providerCode: 20429,
      })
    )

    await expect(
      deliverOutboundMessage(job(retryState, 0), registryFor(retrySend).registry)
    ).rejects.toThrow("Retryable outbound send failure: 20429")
    await expect(messageStatus(retryState.messageId)).resolves.toMatchObject({
      status: "pending",
    })

    const finalState = await createPendingOutbound("twilio")
    await deliverOutboundMessage(
      job(finalState, 3),
      registryFor(retrySend).registry
    )
    await expect(messageStatus(finalState.messageId)).resolves.toMatchObject({
      status: "failed",
    })
    const [event] = await database.db
      .select({ data: auditEvents.data })
      .from(auditEvents)
      .where(eq(auditEvents.subjectId, finalState.messageId))
    expect(event?.data).toEqual({
      reason: "retry_exhausted",
      providerCode: 20429,
    })
  })

  it("does not send a message that already left pending", async () => {
    const state = await createPendingOutbound("twilio")
    await database.db
      .update(messages)
      .set({ status: "sent", externalMessageId: "SM22222222222222222222222222222222" })
      .where(eq(messages.id, state.messageId))
    const send = vi.fn()

    await deliverOutboundMessage(job(state), registryFor(send).registry)

    expect(send).not.toHaveBeenCalled()
  })

  it("fails closed when the provider has no adapter", async () => {
    const state = await createPendingOutbound("meta_cloud")
    const registry: ChannelAdapterRegistry = { adapterFor: () => undefined }

    await deliverOutboundMessage(job(state), registry)

    await expect(messageStatus(state.messageId)).resolves.toMatchObject({
      status: "failed",
    })
    const [event] = await database.db
      .select({ data: auditEvents.data })
      .from(auditEvents)
      .where(eq(auditEvents.subjectId, state.messageId))
    expect(event?.data).toEqual({ reason: "provider_rejected" })
    expect(publish).toHaveBeenCalledOnce()
  })
})
