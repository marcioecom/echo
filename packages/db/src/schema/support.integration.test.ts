import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { PostgreSqlContainer } from "@testcontainers/postgresql"
import { createId } from "@workspace/domain"
import { eq, sql } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createDatabase } from "../client"
import {
  auditEvents,
  baileysAuthKeys,
  channelConnectionProviderBindings,
  channelConnections,
  channelIdentities,
  channelSessionStates,
  contacts,
  messages,
  organizations,
  supportConversations,
} from "./index"

describe("support schema invariants", () => {
  const container = new PostgreSqlContainer("pgvector/pgvector:pg18")
  let database: ReturnType<typeof createDatabase>
  let connectionUri = ""
  let stop: () => Promise<void>

  beforeAll(async () => {
    const postgres = await container.start()
    connectionUri = postgres.getConnectionUri()
    stop = () => postgres.stop().then(() => undefined)
    database = createDatabase(connectionUri, 10_000)
    await database.db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`)
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

  it("enforces typed Message content", async () => {
    const organizationId = await createOrganization("message-content")
    const contactId = createId()
    const channelIdentityId = createId()
    const channelConnectionId = createId()
    const supportConversationId = createId()
    await database.db.insert(contacts).values({ id: contactId, organizationId })
    await database.db.insert(channelIdentities).values({
      id: channelIdentityId,
      organizationId,
      contactId,
      channelType: "whatsapp",
      address: "+5511777777777",
    })
    await database.db.insert(channelConnections).values({
      id: channelConnectionId,
      organizationId,
      channelType: "whatsapp",
      name: "Support",
      address: "+5511000000004",
      status: "active",
    })
    await database.db.insert(supportConversations).values({
      id: supportConversationId,
      organizationId,
      channelIdentityId,
      channelConnectionId,
    })
    const baseMessage = {
      organizationId,
      supportConversationId,
      channelConnectionId,
      direction: "inbound" as const,
      senderType: "contact" as const,
      status: "received" as const,
      occurredAt: new Date(),
    }

    await expect(
      database.db.insert(messages).values({
        ...baseMessage,
        contentType: "text",
        body: "Help",
      })
    ).resolves.toBeDefined()
    await expect(
      database.db.insert(messages).values({
        ...baseMessage,
        contentType: "unsupported",
        body: null,
      })
    ).resolves.toBeDefined()
    await expect(
      database.db.insert(messages).values({
        ...baseMessage,
        contentType: "text",
        body: null,
      })
    ).rejects.toThrow()
    await expect(
      database.db.insert(messages).values({
        ...baseMessage,
        contentType: "unsupported",
        body: "invented text",
      })
    ).rejects.toThrow()
  })

  it("keeps an existing Twilio binding readable and accepts the widened providers", async () => {
    const organizationId = await createOrganization("provider-widen")
    const twilioConnectionId = createId()
    const baileysConnectionId = createId()
    const metaConnectionId = createId()
    const rejectedConnectionId = createId()
    await database.db.insert(channelConnections).values([
      {
        id: twilioConnectionId,
        organizationId,
        channelType: "whatsapp",
        name: "Twilio support",
        address: "+5511000000101",
        status: "active",
      },
      {
        id: baileysConnectionId,
        organizationId,
        channelType: "whatsapp",
        name: "QR support",
        address: "+5511000000102",
        status: "pending",
      },
      {
        id: metaConnectionId,
        organizationId,
        channelType: "whatsapp",
        name: "Cloud API",
        address: "+5511000000103",
        status: "pending",
      },
      {
        id: rejectedConnectionId,
        organizationId,
        channelType: "whatsapp",
        name: "Rejected",
        address: "+5511000000199",
        status: "pending",
      },
    ])

    const credentials = {
      credentialsCiphertext: "ciphertext",
      credentialsNonce: "nonce",
      credentialsAuthTag: "tag",
      credentialsKeyVersion: "v1",
    }
    await database.db.insert(channelConnectionProviderBindings).values({
      organizationId,
      channelConnectionId: twilioConnectionId,
      provider: "twilio",
      externalAccountId: "AC10101010101010101010101010101010",
      externalSenderId: "XE10101010101010101010101010101010",
      routingAddress: "+5511000000101",
      ...credentials,
    })

    const [twilioBinding] = await database.db
      .select({
        provider: channelConnectionProviderBindings.provider,
        externalAccountId: channelConnectionProviderBindings.externalAccountId,
        credentialsCiphertext:
          channelConnectionProviderBindings.credentialsCiphertext,
        displayName: channelConnections.displayName,
        inboxId: channelConnections.inboxId,
        name: channelConnections.name,
      })
      .from(channelConnectionProviderBindings)
      .innerJoin(
        channelConnections,
        eq(channelConnections.id, channelConnectionProviderBindings.channelConnectionId)
      )
      .where(eq(channelConnectionProviderBindings.channelConnectionId, twilioConnectionId))

    expect(twilioBinding).toMatchObject({
      provider: "twilio",
      externalAccountId: "AC10101010101010101010101010101010",
      credentialsCiphertext: "ciphertext",
      displayName: null,
      inboxId: null,
      name: "Twilio support",
    })

    await database.db
      .update(channelConnections)
      .set({ displayName: "Suporte principal", inboxId: createId() })
      .where(eq(channelConnections.id, twilioConnectionId))

    await database.db.insert(channelConnectionProviderBindings).values({
      organizationId,
      channelConnectionId: baileysConnectionId,
      provider: "baileys",
      externalAccountId: "baileys-account",
      externalSenderId: "baileys-sender",
      routingAddress: "+5511000000102",
      ...credentials,
    })
    await database.db.insert(channelConnectionProviderBindings).values({
      organizationId,
      channelConnectionId: metaConnectionId,
      provider: "meta_cloud",
      externalAccountId: "meta-account",
      externalSenderId: "meta-sender",
      routingAddress: "+5511000000103",
      ...credentials,
    })

    await expect(
      database.db.execute(sql`
        insert into channel_connection_provider_bindings (
          id,
          organization_id,
          channel_connection_id,
          provider,
          external_account_id,
          external_sender_id,
          routing_address,
          credentials_ciphertext,
          credentials_nonce,
          credentials_auth_tag,
          credentials_key_version
        ) values (
          ${createId()},
          ${organizationId},
          ${rejectedConnectionId},
          'sms',
          'AC99999999999999999999999999999999',
          'XE99999999999999999999999999999999',
          '+5511000000199',
          'ciphertext',
          'nonce',
          'tag',
          'v1'
        )
      `)
    ).rejects.toThrow()
  })

  it("stores session state and Baileys auth keys per connection", async () => {
    const organizationId = await createOrganization("session-state")
    const otherOrganizationId = await createOrganization("session-state-other")
    const channelConnectionId = createId()
    await database.db.insert(channelConnections).values({
      id: channelConnectionId,
      organizationId,
      channelType: "whatsapp",
      name: "QR",
      address: "+5511000000104",
      status: "pending",
    })

    await database.db.insert(channelSessionStates).values({
      organizationId,
      channelConnectionId,
      state: "qr_pending",
    })
    await expect(
      database.db.insert(channelSessionStates).values({
        organizationId,
        channelConnectionId,
        state: "connected",
      })
    ).rejects.toThrow()
    await expect(
      database.db.insert(channelSessionStates).values({
        organizationId: otherOrganizationId,
        channelConnectionId,
        state: "connecting",
      })
    ).rejects.toThrow()
    await expect(
      database.db.execute(sql`
        update channel_session_states
        set state = 'banned'
        where channel_connection_id = ${channelConnectionId}
      `)
    ).rejects.toThrow()

    await database.db.insert(baileysAuthKeys).values({
      organizationId,
      channelConnectionId,
      keyType: "creds",
      keyId: "creds",
      ciphertext: "ciphertext",
      nonce: "nonce",
      authTag: "tag",
      keyVersion: "v1",
    })
    await expect(
      database.db.insert(baileysAuthKeys).values({
        organizationId,
        channelConnectionId,
        keyType: "creds",
        keyId: "creds",
        ciphertext: "other",
        nonce: "nonce",
        authTag: "tag",
        keyVersion: "v1",
      })
    ).rejects.toThrow()
    await expect(
      database.db.insert(baileysAuthKeys).values({
        organizationId,
        channelConnectionId,
        keyType: "pre-key",
        keyId: "1",
        ciphertext: "ciphertext",
        nonce: "nonce",
        authTag: "tag",
        keyVersion: "v1",
      })
    ).resolves.toBeDefined()
  })

  it("rejects a duplicate external message id on the same connection", async () => {
    const organizationId = await createOrganization("external-id")
    const contactId = createId()
    const channelIdentityId = createId()
    const channelConnectionId = createId()
    const supportConversationId = createId()
    await database.db.insert(contacts).values({ id: contactId, organizationId })
    await database.db.insert(channelIdentities).values({
      id: channelIdentityId,
      organizationId,
      contactId,
      channelType: "whatsapp",
      address: "+5511666666666",
    })
    await database.db.insert(channelConnections).values({
      id: channelConnectionId,
      organizationId,
      channelType: "whatsapp",
      name: "Support",
      address: "+5511000000105",
      status: "active",
    })
    await database.db.insert(supportConversations).values({
      id: supportConversationId,
      organizationId,
      channelIdentityId,
      channelConnectionId,
    })
    const message = {
      organizationId,
      supportConversationId,
      channelConnectionId,
      direction: "inbound" as const,
      senderType: "contact" as const,
      contentType: "text" as const,
      body: "Help",
      status: "received" as const,
      externalMessageId: "SM10101010101010101010101010101010",
      occurredAt: new Date(),
    }
    await database.db.insert(messages).values(message)
    await expect(database.db.insert(messages).values(message)).rejects.toThrow()
  })

  it("keeps existing Twilio rows when the multi-provider migration runs", async () => {
    await database.pool.query("CREATE DATABASE provider_upgrade")
    const url = new URL(connectionUri)
    url.pathname = "/provider_upgrade"
    const upgrade = createDatabase(url.toString(), 10_000)

    try {
      await upgrade.pool.query("CREATE EXTENSION IF NOT EXISTS vector")
      const journal = JSON.parse(
        readFileSync(resolve(process.cwd(), "migrations/meta/_journal.json"), "utf8")
      ) as { entries: Array<{ tag: string }> }
      const tags = journal.entries.map((entry) => entry.tag)
      const upgradeTag = tags.find((tag) => {
        const text = readFileSync(
          resolve(process.cwd(), "migrations", `${tag}.sql`),
          "utf8"
        )
        return text.includes("'baileys'") && text.includes("'meta_cloud'")
      })
      if (!upgradeTag) throw new Error("multi-provider migration was not generated")

      for (const tag of tags) {
        if (tag === upgradeTag) break
        await applyMigration(upgrade, tag)
      }

      const organizationId = createId()
      const channelConnectionId = createId()
      const bindingId = createId()
      await upgrade.pool.query(
        `insert into organizations (id, name, slug, created_at, status)
         values ($1, 'Legacy', $2, now(), 'active')`,
        [organizationId, `legacy-${organizationId.toLowerCase()}`]
      )
      await upgrade.pool.query(
        `insert into channel_connections (
           id, organization_id, channel_type, name, address, status
         ) values ($1, $2, 'whatsapp', 'Legacy support', '+5511000000888', 'active')`,
        [channelConnectionId, organizationId]
      )
      await upgrade.pool.query(
        `insert into channel_connection_provider_bindings (
           id, organization_id, channel_connection_id, provider,
           external_account_id, external_sender_id, routing_address,
           credentials_ciphertext, credentials_nonce, credentials_auth_tag,
           credentials_key_version
         ) values (
           $1, $2, $3, 'twilio',
           'AC88888888888888888888888888888888',
           'XE88888888888888888888888888888888',
           '+5511000000888',
           'legacy-ciphertext', 'legacy-nonce', 'legacy-tag', 'v1'
         )`,
        [bindingId, organizationId, channelConnectionId]
      )

      await applyMigration(upgrade, upgradeTag)

      const binding = await upgrade.pool.query<{
        provider: string
        credentials_ciphertext: string
        external_account_id: string
        name: string
        display_name: string | null
        inbox_id: string | null
      }>(
        `select bindings.provider, bindings.credentials_ciphertext,
                bindings.external_account_id, connections.name,
                connections.display_name, connections.inbox_id
         from channel_connection_provider_bindings bindings
         join channel_connections connections on connections.id = bindings.channel_connection_id
         where bindings.id = $1`,
        [bindingId]
      )
      expect(binding.rows[0]).toEqual({
        provider: "twilio",
        credentials_ciphertext: "legacy-ciphertext",
        external_account_id: "AC88888888888888888888888888888888",
        name: "Legacy support",
        display_name: null,
        inbox_id: null,
      })
    } finally {
      await upgrade.close()
    }
  })
})

async function applyMigration(
  database: ReturnType<typeof createDatabase>,
  tag: string
) {
  const text = readFileSync(
    resolve(process.cwd(), "migrations", `${tag}.sql`),
    "utf8"
  )
  for (const statement of text.split("--> statement-breakpoint")) {
    const trimmed = statement.trim()
    if (trimmed) await database.pool.query(trimmed)
  }
}
