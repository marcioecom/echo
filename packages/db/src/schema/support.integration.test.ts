import { resolve } from "node:path"

import { PostgreSqlContainer } from "@testcontainers/postgresql"
import { createId } from "@workspace/domain"
import { eq } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createDatabase } from "../client"
import {
  auditEvents,
  channelConnectionProviderBindings,
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
      })
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
      database.db.insert(supportConversations).values(conversation)
    ).rejects.toThrow()

    await database.db
      .update(supportConversations)
      .set({ status: "resolved", resolvedAt: new Date() })
      .where(eq(supportConversations.id, firstConversationId))

    await expect(
      database.db.insert(supportConversations).values(conversation)
    ).resolves.toBeDefined()
  })

  it("keeps provider bindings tenant-qualified and routing identities unique", async () => {
    const firstOrganizationId = await createOrganization("provider-first")
    const secondOrganizationId = await createOrganization("provider-second")
    const firstConnectionId = createId()
    const secondConnectionId = createId()

    await database.db.insert(channelConnections).values([
      {
        id: firstConnectionId,
        organizationId: firstOrganizationId,
        channelType: "whatsapp",
        name: "First support",
        address: "+5511000000001",
        status: "active",
      },
      {
        id: secondConnectionId,
        organizationId: secondOrganizationId,
        channelType: "whatsapp",
        name: "Second support",
        address: "+5511000000002",
        status: "active",
      },
    ])

    const credentials = {
      credentialsCiphertext: "ciphertext",
      credentialsNonce: "nonce",
      credentialsAuthTag: "tag",
      credentialsKeyVersion: "v1",
    }

    await expect(
      database.db.insert(channelConnectionProviderBindings).values({
        organizationId: secondOrganizationId,
        channelConnectionId: firstConnectionId,
        provider: "twilio",
        externalAccountId: "AC11111111111111111111111111111111",
        externalSenderId: "XE11111111111111111111111111111111",
        routingAddress: "+5511000000001",
        ...credentials,
      })
    ).rejects.toThrow()

    await database.db.insert(channelConnectionProviderBindings).values({
      organizationId: firstOrganizationId,
      channelConnectionId: firstConnectionId,
      provider: "twilio",
      externalAccountId: "AC11111111111111111111111111111111",
      externalSenderId: "XE11111111111111111111111111111111",
      routingAddress: "+5511000000001",
      ...credentials,
    })

    await expect(
      database.db.insert(channelConnectionProviderBindings).values({
        organizationId: secondOrganizationId,
        channelConnectionId: secondConnectionId,
        provider: "twilio",
        externalAccountId: "AC11111111111111111111111111111111",
        externalSenderId: "XE22222222222222222222222222222222",
        routingAddress: "+5511000000001",
        ...credentials,
      })
    ).rejects.toThrow()
  })

  it("allows only one provider binding per Channel Connection", async () => {
    const organizationId = await createOrganization("provider-single")
    const channelConnectionId = createId()
    await database.db.insert(channelConnections).values({
      id: channelConnectionId,
      organizationId,
      channelType: "whatsapp",
      name: "Support",
      address: "+5511000000003",
      status: "active",
    })

    const binding = {
      organizationId,
      channelConnectionId,
      provider: "twilio" as const,
      externalAccountId: "AC33333333333333333333333333333333",
      externalSenderId: "XE33333333333333333333333333333333",
      routingAddress: "+5511000000003",
      credentialsCiphertext: "ciphertext",
      credentialsNonce: "nonce",
      credentialsAuthTag: "tag",
      credentialsKeyVersion: "v1",
    }
    await database.db.insert(channelConnectionProviderBindings).values(binding)

    await expect(
      database.db.insert(channelConnectionProviderBindings).values({
        ...binding,
        id: createId(),
        externalAccountId: "AC44444444444444444444444444444444",
        externalSenderId: "XE44444444444444444444444444444444",
      })
    ).rejects.toThrow()
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
        .where(eq(auditEvents.id, auditEventId))
    ).rejects.toThrow()
  })
})
