import { resolve } from "node:path"

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
import { eq, sql } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { SupportInboxRepository } from "./repositories/support-inbox-repository"

const { databaseRef } = vi.hoisted(() => ({
  databaseRef: { current: {} as object },
}))

vi.mock("../../lib/db", () => ({
  database: {
    db: new Proxy(
      {},
      {
        get: (_target, property) => Reflect.get(databaseRef.current, property),
      }
    ),
  },
}))

describe("Support Inbox projections", () => {
  const container = new PostgreSqlContainer("pgvector/pgvector:pg18")
  let database: ReturnType<typeof createDatabase>
  let stop: () => Promise<void>

  beforeAll(async () => {
    const postgres = await container.start()
    stop = () => postgres.stop().then(() => undefined)
    database = createDatabase(postgres.getConnectionUri(), 10_000)
    databaseRef.current = database.db
    await database.db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`)
    await migrate(database.db, {
      migrationsFolder: resolve(process.cwd(), "../../packages/db/migrations"),
    })
  }, 60_000)

  afterAll(async () => {
    await Promise.allSettled([database?.close(), stop?.()])
  })

  async function createConversationFixture(input: {
    slug: string
    displayName: string | null
    address: string
  }) {
    const organizationId = createId()
    const channelConnectionId = createId()
    const contactId = createId()
    const channelIdentityId = createId()
    const conversationId = createId()
    const firstOccurredAt = new Date("2026-08-02T12:00:00.000Z")
    const lastOccurredAt = new Date("2026-08-02T12:05:00.000Z")

    await database.db.insert(organizations).values({
      id: organizationId,
      name: input.slug,
      slug: input.slug,
      status: "active",
      createdAt: new Date(),
    })
    await database.db.insert(channelConnections).values({
      id: channelConnectionId,
      organizationId,
      channelType: "whatsapp",
      name: "WhatsApp Support",
      address: "+5511000000000",
      status: "active",
    })
    await database.db.insert(contacts).values({
      id: contactId,
      organizationId,
      displayName: input.displayName,
    })
    await database.db.insert(channelIdentities).values({
      id: channelIdentityId,
      organizationId,
      contactId,
      channelType: "whatsapp",
      address: input.address,
    })
    await database.db.insert(supportConversations).values({
      id: conversationId,
      organizationId,
      channelIdentityId,
      channelConnectionId,
      status: "human_required",
      lastActivityAt: lastOccurredAt,
    })
    await database.db.insert(messages).values([
      {
        organizationId,
        supportConversationId: conversationId,
        channelConnectionId,
        direction: "inbound",
        senderType: "contact",
        contentType: "text",
        body: "First message",
        status: "received",
        occurredAt: firstOccurredAt,
      },
      {
        organizationId,
        supportConversationId: conversationId,
        channelConnectionId,
        direction: "inbound",
        senderType: "contact",
        contentType: "text",
        body: "Latest message",
        status: "received",
        occurredAt: lastOccurredAt,
      },
    ])

    return { organizationId, conversationId, channelConnectionId }
  }

  it("projects the latest Message and isolates list data by Organization", async () => {
    const acme = await createConversationFixture({
      slug: "inbox-acme",
      displayName: "Ana",
      address: "+5511999999999",
    })
    const other = await createConversationFixture({
      slug: "inbox-other",
      displayName: null,
      address: "+5511888888888",
    })
    const repository = new SupportInboxRepository(database.db)

    const result = await repository.list({
      organizationId: acme.organizationId,
      limit: 10,
    })

    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      id: acme.conversationId,
      contact: { displayName: "Ana", address: "+5511999999999" },
      lastMessage: { preview: "Latest message", senderType: "contact" },
    })
    expect(result.items.some((item) => item.id === other.conversationId)).toBe(
      false
    )
  })

  it("orders the canonical timeline and hides cross-tenant details", async () => {
    const acme = await createConversationFixture({
      slug: "inbox-detail-acme",
      displayName: "Bea",
      address: "+5511777777777",
    })
    const other = await createConversationFixture({
      slug: "inbox-detail-other",
      displayName: "Caio",
      address: "+5511666666666",
    })
    const repository = new SupportInboxRepository(database.db)

    const detail = await repository.findDetail(acme)
    const crossTenant = await repository.findDetail({
      organizationId: acme.organizationId,
      conversationId: other.conversationId,
    })

    expect(detail?.messages.map((message) => message.body)).toEqual([
      "First message",
      "Latest message",
    ])
    expect(detail?.events).toEqual([])
    expect(detail?.conversation.handoffReason).toBeNull()
    expect(crossTenant).toBeNull()
  })

  it("projects the handoff summary and AI escalation event", async () => {
    const acme = await createConversationFixture({
      slug: "inbox-handoff",
      displayName: "Lia",
      address: "+5511555555555",
    })
    const occurredAt = new Date("2026-08-02T12:06:00.000Z")
    const [inbound] = await database.db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.supportConversationId, acme.conversationId))
      .limit(1)
    await database.db
      .update(supportConversations)
      .set({
        handoffReason: "low_confidence",
        handoffSummary: "Quer trocar o endereço. A base não cobre. Tom calmo.",
      })
      .where(eq(supportConversations.id, acme.conversationId))
    await database.db.insert(messages).values({
      organizationId: acme.organizationId,
      supportConversationId: acme.conversationId,
      channelConnectionId: acme.channelConnectionId,
      direction: "outbound",
      senderType: "ai",
      contentType: "text",
      body: "Vou chamar alguém da equipe pra continuar com você.",
      status: "pending",
      replyToMessageId: inbound?.id,
      occurredAt,
    })
    await database.db.insert(auditEvents).values({
      organizationId: acme.organizationId,
      eventType: "support_conversation.human_required",
      actorType: "ai",
      subjectType: "support_conversation",
      subjectId: acme.conversationId,
      data: { reason: "low_confidence" },
      occurredAt,
    })
    const repository = new SupportInboxRepository(database.db)

    const detail = await repository.findDetail(acme)

    expect(detail?.conversation).toMatchObject({
      handoffReason: "low_confidence",
      handoffSummary: "Quer trocar o endereço. A base não cobre. Tom calmo.",
    })
    expect(detail?.events).toEqual([
      {
        id: expect.any(String),
        actorType: "ai",
        occurredAt,
        reason: "low_confidence",
      },
    ])
    expect(detail?.messages.at(-1)).toMatchObject({
      senderType: "ai",
      body: "Vou chamar alguém da equipe pra continuar com você.",
    })
  })
})
