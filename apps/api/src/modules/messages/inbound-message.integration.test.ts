import { resolve } from "node:path"

import formbody from "@fastify/formbody"
import { PostgreSqlContainer } from "@testcontainers/postgresql"
import { createDatabase } from "@workspace/db"
import {
  auditEvents,
  channelConnections,
  channelIdentities,
  contacts,
  messages,
  organizations,
  supportConversations,
} from "@workspace/db/schema"
import { createId } from "@workspace/domain"
import { and, asc, count, eq } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import Fastify from "fastify"
import twilio from "twilio"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

const { databaseRef, enqueue } = vi.hoisted(() => ({
  databaseRef: { current: {} as object },
  enqueue: vi.fn(),
}))

vi.mock("../../lib/db", () => ({
  database: new Proxy(
    {},
    {
      get: (_target, property) => Reflect.get(databaseRef.current, property),
    }
  ),
}))
vi.mock("../../lib/jobs-client", () => ({ jobs: { enqueue } }))

import { createChannelCredentialsCipher } from "../channel-connections/adapters/channel-credentials-cipher"
import { registerTwilioWhatsAppWebhook } from "../channel-connections/http/register-twilio-whatsapp-webhook"
import { createChannelConnectionsRepository } from "../channel-connections/repositories/channel-connections-repository"
import { createAuthenticateTwilioWebhook } from "../channel-connections/services/authenticate-twilio-webhook"
import { persistInboundMessage } from "./repositories/inbound-message-repository"

describe("inbound Message persistence", () => {
  const container = new PostgreSqlContainer("postgres:17-alpine")
  let database: ReturnType<typeof createDatabase>
  let stop: () => Promise<void>

  beforeAll(async () => {
    const postgres = await container.start()
    stop = () => postgres.stop().then(() => undefined)
    database = createDatabase(postgres.getConnectionUri(), 10_000)
    databaseRef.current = database
    await migrate(database.db, {
      migrationsFolder: resolve(process.cwd(), "../../packages/db/migrations"),
    })
  }, 60_000)

  afterAll(async () => {
    await Promise.allSettled([database?.close(), stop?.()])
  })

  async function createTenant(slug: string, address: string) {
    const organizationId = createId()
    const channelConnectionId = createId()
    await database.db.insert(organizations).values({
      id: organizationId,
      name: slug,
      slug,
      status: "active",
      createdAt: new Date(),
    })
    await database.db.insert(channelConnections).values({
      id: channelConnectionId,
      organizationId,
      channelType: "whatsapp",
      name: "Support",
      address,
      status: "active",
    })
    return { organizationId, channelConnectionId }
  }

  function inbound(
    tenant: Awaited<ReturnType<typeof createTenant>>,
    externalMessageId: string,
    receivedAt: Date
  ) {
    return {
      ...tenant,
      channelType: "whatsapp" as const,
      senderAddress: "+5511999999999",
      senderDisplayName: "Initial name",
      externalMessageId,
      content: { type: "text" as const, body: "Help" },
      receivedAt,
    }
  }

  it("creates once, reuses active support records, and does not move activity backward", async () => {
    const tenant = await createTenant("inbound-reuse", "+5511000000101")
    const later = new Date("2026-07-30T12:10:00.000Z")
    const earlier = new Date("2026-07-30T12:00:00.000Z")

    const first = await persistInboundMessage(
      inbound(tenant, "SM11111111111111111111111111111111", later)
    )
    await database.db
      .update(contacts)
      .set({ displayName: "Operator name" })
      .where(eq(contacts.id, first.contactId))
    const second = await persistInboundMessage({
      ...inbound(tenant, "SM22222222222222222222222222222222", earlier),
      senderDisplayName: "Provider name",
    })
    const duplicate = await persistInboundMessage(
      inbound(tenant, "SM11111111111111111111111111111111", later)
    )

    expect(second).toMatchObject({
      contactId: first.contactId,
      channelIdentityId: first.channelIdentityId,
      supportConversationId: first.supportConversationId,
      duplicate: false,
    })
    expect(duplicate).toEqual({ ...first, duplicate: true })

    const [contact] = await database.db
      .select()
      .from(contacts)
      .where(eq(contacts.id, first.contactId))
    const [conversation] = await database.db
      .select()
      .from(supportConversations)
      .where(eq(supportConversations.id, first.supportConversationId))
    expect(contact?.displayName).toBe("Operator name")
    expect(conversation?.lastActivityAt).toEqual(later)
  })

  it("shares identity across connections but creates one Conversation per connection", async () => {
    const tenant = await createTenant(
      "inbound-multiple-connections",
      "+5511000000102"
    )
    const secondConnectionId = createId()
    await database.db.insert(channelConnections).values({
      id: secondConnectionId,
      organizationId: tenant.organizationId,
      channelType: "whatsapp",
      name: "Second support",
      address: "+5511000000103",
      status: "active",
    })
    const receivedAt = new Date("2026-07-30T12:00:00.000Z")

    const first = await persistInboundMessage(
      inbound(tenant, "SM33333333333333333333333333333333", receivedAt)
    )
    const second = await persistInboundMessage(
      inbound(
        { ...tenant, channelConnectionId: secondConnectionId },
        "SM44444444444444444444444444444444",
        receivedAt
      )
    )

    expect(second.contactId).toBe(first.contactId)
    expect(second.channelIdentityId).toBe(first.channelIdentityId)
    expect(second.supportConversationId).not.toBe(first.supportConversationId)
  })

  it("creates a new Conversation after resolution", async () => {
    const tenant = await createTenant(
      "inbound-after-resolution",
      "+5511000000104"
    )
    const first = await persistInboundMessage(
      inbound(
        tenant,
        "SM55555555555555555555555555555555",
        new Date("2026-07-30T12:00:00.000Z")
      )
    )
    await database.db
      .update(supportConversations)
      .set({ status: "resolved", resolvedAt: new Date() })
      .where(eq(supportConversations.id, first.supportConversationId))

    const second = await persistInboundMessage(
      inbound(
        tenant,
        "SM66666666666666666666666666666666",
        new Date("2026-07-30T12:01:00.000Z")
      )
    )

    expect(second.channelIdentityId).toBe(first.channelIdentityId)
    expect(second.supportConversationId).not.toBe(first.supportConversationId)
  })

  it("persists one Message for concurrent copies of one provider event", async () => {
    const tenant = await createTenant(
      "inbound-concurrent-duplicate",
      "+5511000000106"
    )
    const input = inbound(
      tenant,
      "SMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      new Date("2026-07-30T12:00:00.000Z")
    )

    const results = await Promise.all([
      persistInboundMessage(input),
      persistInboundMessage(input),
    ])

    expect(results.map((result) => result.duplicate).sort()).toEqual([
      false,
      true,
    ])
    expect(results[0]?.messageId).toBe(results[1]?.messageId)
  })

  it("serializes concurrent first messages and audits unsupported content", async () => {
    const tenant = await createTenant("inbound-concurrent", "+5511000000105")
    const receivedAt = new Date("2026-07-30T12:00:00.000Z")
    const [first, second] = await Promise.all([
      persistInboundMessage(
        inbound(tenant, "SM77777777777777777777777777777777", receivedAt)
      ),
      persistInboundMessage({
        ...inbound(tenant, "SM88888888888888888888888888888888", receivedAt),
        content: { type: "unsupported" as const, mediaKind: "audio" as const },
      }),
    ])

    expect(second.contactId).toBe(first.contactId)
    expect(second.channelIdentityId).toBe(first.channelIdentityId)
    expect(second.supportConversationId).toBe(first.supportConversationId)

    const [entityCounts] = await database.db
      .select({
        contacts: count(contacts.id),
        identities: count(channelIdentities.id),
        conversations: count(supportConversations.id),
      })
      .from(contacts)
      .innerJoin(
        channelIdentities,
        and(
          eq(channelIdentities.organizationId, contacts.organizationId),
          eq(channelIdentities.contactId, contacts.id)
        )
      )
      .innerJoin(
        supportConversations,
        and(
          eq(
            supportConversations.organizationId,
            channelIdentities.organizationId
          ),
          eq(supportConversations.channelIdentityId, channelIdentities.id)
        )
      )
      .where(eq(contacts.organizationId, tenant.organizationId))
    expect(entityCounts).toEqual({
      contacts: 1,
      identities: 1,
      conversations: 1,
    })

    const storedMessages = await database.db
      .select()
      .from(messages)
      .where(eq(messages.organizationId, tenant.organizationId))
      .orderBy(asc(messages.externalMessageId))
    expect(storedMessages).toHaveLength(2)
    expect(
      storedMessages.find((message) => message.contentType === "unsupported")
    ).toMatchObject({ body: null, status: "received" })

    const [audit] = await database.db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.organizationId, tenant.organizationId),
          eq(auditEvents.eventType, "message.unsupported_content")
        )
      )
    expect(audit?.data).toEqual({ mediaKind: "audio" })
  })

  it("commits before enqueue failure and repairs publication on Twilio retry", async () => {
    const organizationId = createId()
    await database.db.insert(organizations).values({
      id: organizationId,
      name: "Webhook retry",
      slug: "webhook-retry",
      status: "active",
      createdAt: new Date(),
    })
    const authToken = "twilio-auth-token"
    const accountSid = "AC99999999999999999999999999999999"
    const receivingAddress = "+5511000000199"
    const connections = createChannelConnectionsRepository(database.db)
    const cipher = createChannelCredentialsCipher({
      encryptionKey: Buffer.alloc(32, 7).toString("base64"),
      keyVersion: "v1",
    })
    const { channelConnectionId } =
      await connections.saveVerifiedTwilioConnection({
        organizationId,
        name: "WhatsApp Support",
        address: receivingAddress,
        accountSid,
        externalSenderId: "XE99999999999999999999999999999999",
        encryptCredentials: (id) =>
          cipher.encrypt(authToken, {
            organizationId,
            channelConnectionId: id,
            provider: "twilio",
          }),
      })
    let enqueueAttempts = 0
    enqueue.mockImplementation(async () => {
      if (enqueueAttempts++ === 0) throw new Error("Redis unavailable")
      return { id: "process-inbound-message--retry" }
    })
    const app = Fastify({ logger: false })
    app.register(formbody)
    registerTwilioWhatsAppWebhook(app, {
      publicApiUrl: "https://api.example.com",
      authenticate: createAuthenticateTwilioWebhook({
        repository: connections,
        credentialsCipher: cipher,
      }),
    })
    const url = "https://api.example.com/webhooks/twilio/whatsapp/inbound"
    const form = {
      MessageSid: "SM99999999999999999999999999999999",
      AccountSid: accountSid,
      From: "whatsapp:+5511999999999",
      To: `whatsapp:${receivingAddress}`,
      Body: "Help",
      ProfileName: "Maria",
      NumMedia: "0",
    }
    const signature = twilio.getExpectedTwilioSignature(authToken, url, form)
    const request = {
      method: "POST" as const,
      url: "/webhooks/twilio/whatsapp/inbound",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-twilio-signature": signature,
      },
      payload: new URLSearchParams(form).toString(),
    }

    const failed = await app.inject(request)
    const retried = await app.inject(request)

    expect(failed.statusCode).toBe(503)
    expect(retried.statusCode).toBe(200)
    expect(enqueueAttempts).toBe(2)
    const [messageCount] = await database.db
      .select({ value: count() })
      .from(messages)
      .where(
        and(
          eq(messages.organizationId, organizationId),
          eq(messages.channelConnectionId, channelConnectionId),
          eq(messages.externalMessageId, form.MessageSid)
        )
      )
    expect(messageCount?.value).toBe(1)
    await app.close()
  })
})
