import { resolve } from "node:path"

import { PostgreSqlContainer } from "@testcontainers/postgresql"
import { createId } from "@workspace/domain"
import { eq } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createDatabase } from "../client"
import {
  auditEvents,
  channelConnections,
  channelIdentities,
  contacts,
  organizations,
  supportConversations,
} from "./index"

describe("support schema invariants", () => {
  const container = new PostgreSqlContainer("postgres:17-alpine")
  let database: ReturnType<typeof createDatabase>
  let stop: () => Promise<void>

  beforeAll(async () => {
    const postgres = await container.start()
    stop = () => postgres.stop().then(() => undefined)
    database = createDatabase(postgres.getConnectionUri(), 10_000)
    await migrate(database.db, {
      migrationsFolder: resolve(process.cwd(), "migrations"),
    })
  }, 60_000)

  afterAll(async () => {
    await Promise.allSettled([database?.close(), stop?.()])
  })

  async function createOrganization(slug: string): Promise<string> {
    const id = createId()
    await database.db.insert(organizations).values({
      id,
      name: slug,
      slug,
      status: "active",
      createdAt: new Date(),
    })
    return id
  }

  it("rejects relationships across Organization boundaries", async () => {
    const firstOrganizationId = await createOrganization("first")
    const secondOrganizationId = await createOrganization("second")
    const contactId = createId()

    await database.db.insert(contacts).values({
      id: contactId,
      organizationId: firstOrganizationId,
    })

    await expect(
      database.db.insert(channelIdentities).values({
        organizationId: secondOrganizationId,
        contactId,
        channelType: "whatsapp",
        address: "+5511999999999",
      }),
    ).rejects.toThrow()
  })

  it("allows only one active Conversation per identity and connection", async () => {
    const organizationId = await createOrganization("conversation-test")
    const contactId = createId()
    const channelIdentityId = createId()
    const channelConnectionId = createId()

    await database.db.insert(contacts).values({ id: contactId, organizationId })
    await database.db.insert(channelIdentities).values({
      id: channelIdentityId,
      organizationId,
      contactId,
      channelType: "whatsapp",
      address: "+5511888888888",
    })
    await database.db.insert(channelConnections).values({
      id: channelConnectionId,
      organizationId,
      channelType: "whatsapp",
      name: "Support",
      address: "+5511000000000",
      status: "active",
    })

    const firstConversationId = createId()
    const conversation = {
      organizationId,
      channelIdentityId,
      channelConnectionId,
    }
    await database.db.insert(supportConversations).values({
      id: firstConversationId,
      ...conversation,
    })

    await expect(
      database.db.insert(supportConversations).values(conversation),
    ).rejects.toThrow()

    await database.db
      .update(supportConversations)
      .set({ status: "resolved", resolvedAt: new Date() })
      .where(eq(supportConversations.id, firstConversationId))

    await expect(
      database.db.insert(supportConversations).values(conversation),
    ).resolves.toBeDefined()
  })

  it("prevents Audit Event mutation", async () => {
    const organizationId = await createOrganization("audit-test")
    const auditEventId = createId()

    await database.db.insert(auditEvents).values({
      id: auditEventId,
      organizationId,
      eventType: "test.created",
      actorType: "system",
      subjectType: "test",
      subjectId: createId(),
    })

    await expect(
      database.db
        .update(auditEvents)
        .set({ eventType: "test.changed" })
        .where(eq(auditEvents.id, auditEventId)),
    ).rejects.toThrow()
  })
})
