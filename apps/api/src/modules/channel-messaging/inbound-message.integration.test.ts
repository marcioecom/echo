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
import { and, asc, count, eq } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

const { databaseRef, enqueue } = vi.hoisted(() => ({
  databaseRef: { current: {} as object },
  enqueue: vi.fn(),
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
vi.mock("../../lib/jobs-client", () => ({ jobs: { enqueue } }))

import { InboundMessageRepository } from "./repositories/inbound-message-repository"
import type { NormalizedInboundMessage } from "@workspace/domain"
import { ingestInboundMessage } from "./use-cases/ingest-inbound-message"

describe("inbound Message persistence", () => {
  const container = new PostgreSqlContainer("postgres:17-alpine")
  let database: ReturnType<typeof createDatabase>
  let stop: () => Promise<void>

  beforeAll(async () => {
    const postgres = await container.start()
    stop = () => postgres.stop().then(() => undefined)
    database = createDatabase(postgres.getConnectionUri(), 10_000)
    databaseRef.current = database.db
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

  async function persistInboundMessage(input: NormalizedInboundMessage) {
    return new InboundMessageRepository(database.db).ingest(input)
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
    const receivingAddress = "+5511000000199"
    const channelConnectionId = createId()
    await database.db.insert(channelConnections).values({
      id: channelConnectionId,
      organizationId,
      channelType: "whatsapp",
      name: "WhatsApp Support",
      address: receivingAddress,
      status: "active",
    })
    let enqueueAttempts = 0
    enqueue.mockImplementation(async () => {
      if (enqueueAttempts++ === 0) throw new Error("Redis unavailable")
      return { id: "process-inbound-message--retry" }
    })
    const input = inbound(
      { organizationId, channelConnectionId },
      "SM99999999999999999999999999999999",
      new Date("2026-07-30T12:00:00.000Z")
    )
    const failed = await ingestInboundMessage(input)
    const retried = await ingestInboundMessage(input)

    expect(failed).toMatchObject({
      ok: false,
      error: { type: "queue_unavailable" },
    })
    expect(retried).toMatchObject({ ok: true })
    expect(enqueueAttempts).toBe(2)
    const [messageCount] = await database.db
      .select({ value: count() })
      .from(messages)
      .where(
        and(
          eq(messages.organizationId, organizationId),
          eq(messages.channelConnectionId, channelConnectionId),
          eq(messages.externalMessageId, input.externalMessageId)
        )
      )
    expect(messageCount?.value).toBe(1)
  })
})
