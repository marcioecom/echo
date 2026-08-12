import { resolve } from "node:path"

import { PostgreSqlContainer } from "@testcontainers/postgresql"
import { createDatabase } from "@workspace/db"
import {
  auditEvents,
  channelConnectionProviderBindings,
  channelConnections,
  organizations,
} from "@workspace/db/schema"
import { createId } from "@workspace/domain"
import { count, eq } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import twilio from "twilio"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const { databaseRef, ingestInboundMessage } = vi.hoisted(() => ({
  databaseRef: { current: {} as object },
  ingestInboundMessage: vi.fn(),
}))
vi.mock("../../config/env", () => ({
  env: {
    CHANNEL_CREDENTIALS_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString("base64"),
    CHANNEL_CREDENTIALS_KEY_VERSION: "v1",
  },
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
vi.mock("./use-cases/ingest-inbound-message", () => ({
  ingestInboundMessage,
}))

import { ChannelCredentialsCipher } from "./adapters/channel-credentials-cipher"
import {
  TwilioChannelProvider,
  TwilioConfigurationError,
} from "./adapters/twilio-channel-provider"
import { ChannelConnectionsRepository } from "./repositories/channel-connections-repository"
import { processTwilioInboundMessage } from "./use-cases/process-twilio-inbound-message"
import { provisionWhatsAppChannelConnection } from "./use-cases/provision-whatsapp-channel-connection"

describe("Twilio WhatsApp Channel Connection", () => {
  const container = new PostgreSqlContainer("postgres:17-alpine")
  const authToken = "twilio-auth-token"
  const accountSid = "AC11111111111111111111111111111111"
  const address = "+5511999999999"
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

  beforeEach(() => {
    vi.restoreAllMocks()
    ingestInboundMessage.mockReset()
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

  it("provisions one encrypted, routable connection idempotently", async () => {
    const organizationId = await createOrganization("provisioned-channel")
    const credentialsCipher = new ChannelCredentialsCipher({
      encryptionKey: Buffer.alloc(32, 9).toString("base64"),
      keyVersion: "v1",
    })
    const verifyWhatsAppSender = vi
      .spyOn(TwilioChannelProvider.prototype, "verifyWhatsAppSender")
      .mockResolvedValue({
        externalSenderId: "XE11111111111111111111111111111111",
      })
    const provision = provisionWhatsAppChannelConnection
    const input = {
      organizationId,
      name: "WhatsApp Support",
      address: `whatsapp:${address}`,
      accountSid,
      authToken,
    }

    const first = await provision(input)
    const [firstBinding] = await database.db
      .select()
      .from(channelConnectionProviderBindings)
      .where(
        eq(
          channelConnectionProviderBindings.channelConnectionId,
          first.channelConnectionId
        )
      )
    const second = await provision(input)

    expect(second.channelConnectionId).toBe(first.channelConnectionId)
    expect(verifyWhatsAppSender).toHaveBeenCalledTimes(2)

    const [connectionCount] = await database.db
      .select({ value: count() })
      .from(channelConnections)
      .where(eq(channelConnections.organizationId, organizationId))
    const [binding] = await database.db
      .select()
      .from(channelConnectionProviderBindings)
      .where(
        eq(
          channelConnectionProviderBindings.channelConnectionId,
          first.channelConnectionId
        )
      )
    expect(connectionCount?.value).toBe(1)
    expect(binding).toMatchObject({
      organizationId,
      externalAccountId: accountSid,
      routingAddress: address,
      credentialsKeyVersion: "v1",
    })
    expect(binding?.credentialsCiphertext).not.toBe(
      firstBinding?.credentialsCiphertext
    )
    expect(JSON.stringify(binding)).not.toContain(authToken)

    const decrypted = credentialsCipher.decrypt(
      {
        ciphertext: binding!.credentialsCiphertext,
        nonce: binding!.credentialsNonce,
        authTag: binding!.credentialsAuthTag,
        keyVersion: binding!.credentialsKeyVersion,
      },
      {
        organizationId,
        channelConnectionId: first.channelConnectionId,
        provider: "twilio",
      }
    )
    expect(decrypted).toBe(authToken)
  })

  it("disables the previous route when replacing the WhatsApp address", async () => {
    const organizationId = await createOrganization("replaced-channel")
    const repository = new ChannelConnectionsRepository(database.db)
    vi.spyOn(
      TwilioChannelProvider.prototype,
      "verifyWhatsAppSender"
    )
      .mockResolvedValueOnce({
        externalSenderId: "XE55555555555555555555555555555555",
      })
      .mockResolvedValueOnce({
        externalSenderId: "XE66666666666666666666666666666666",
      })
    const provision = provisionWhatsAppChannelConnection
    const first = await provision({
      organizationId,
      name: "Old number",
      address: "+5511777777777",
      accountSid: "AC55555555555555555555555555555555",
      authToken,
    })
    const replacement = await provision({
      organizationId,
      name: "New number",
      address: "+5511666666666",
      accountSid: "AC66666666666666666666666666666666",
      authToken: "replacement-token",
    })

    const connections = await database.db
      .select({ id: channelConnections.id, status: channelConnections.status })
      .from(channelConnections)
      .where(eq(channelConnections.organizationId, organizationId))
    expect(connections).toEqual(
      expect.arrayContaining([
        { id: first.channelConnectionId, status: "disabled" },
        { id: replacement.channelConnectionId, status: "active" },
      ])
    )
    await expect(
      repository.findActiveTwilioBinding({
        accountSid: "AC55555555555555555555555555555555",
        address: "+5511777777777",
      })
    ).resolves.toBeNull()
  })

  it("preserves the active route when replacement validation fails", async () => {
    const organizationId = await createOrganization("failed-replacement")
    vi.spyOn(
      TwilioChannelProvider.prototype,
      "verifyWhatsAppSender"
    )
      .mockResolvedValueOnce({
        externalSenderId: "XE77777777777777777777777777777777",
      })
      .mockRejectedValueOnce(new TwilioConfigurationError("sender_not_online"))
    const provision = provisionWhatsAppChannelConnection
    const current = await provision({
      organizationId,
      name: "Current",
      address: "+5511555555555",
      accountSid: "AC77777777777777777777777777777777",
      authToken,
    })

    await expect(
      provision({
        organizationId,
        name: "Replacement",
        address: "+5511444444444",
        accountSid: "AC88888888888888888888888888888888",
        authToken: "invalid-replacement-token",
      })
    ).rejects.toMatchObject({ reason: "sender_not_online" })

    const [connection] = await database.db
      .select({ status: channelConnections.status })
      .from(channelConnections)
      .where(eq(channelConnections.id, current.channelConnectionId))
    expect(connection?.status).toBe("active")
  })

  it("rolls back the connection when its provider routing key conflicts", async () => {
    const firstOrganizationId = await createOrganization("routing-owner")
    const secondOrganizationId = await createOrganization("routing-conflict")
    vi.spyOn(
      TwilioChannelProvider.prototype,
      "verifyWhatsAppSender"
    ).mockResolvedValue({
      externalSenderId: "XE99999999999999999999999999999999",
    })
    const provision = provisionWhatsAppChannelConnection
    const sharedRouting = {
      name: "Shared route",
      address: "+5511333333333",
      accountSid: "AC99999999999999999999999999999999",
      authToken,
    }

    await provision({ organizationId: firstOrganizationId, ...sharedRouting })
    await expect(
      provision({ organizationId: secondOrganizationId, ...sharedRouting })
    ).rejects.toThrow()

    const [connectionCount] = await database.db
      .select({ value: count() })
      .from(channelConnections)
      .where(eq(channelConnections.organizationId, secondOrganizationId))
    const [auditCount] = await database.db
      .select({ value: count() })
      .from(auditEvents)
      .where(eq(auditEvents.organizationId, secondOrganizationId))
    expect(connectionCount?.value).toBe(0)
    expect(auditCount?.value).toBe(0)
  })

  it("audits provider validation failures without activating a connection", async () => {
    const organizationId = await createOrganization("invalid-channel")
    vi.spyOn(
      TwilioChannelProvider.prototype,
      "verifyWhatsAppSender"
    ).mockRejectedValue(new TwilioConfigurationError("sender_not_online"))
    const provision = provisionWhatsAppChannelConnection

    await expect(
      provision({
        organizationId,
        name: "Invalid",
        address,
        accountSid: "AC22222222222222222222222222222222",
        authToken,
      })
    ).rejects.toMatchObject({ reason: "sender_not_online" })

    const [connectionCount] = await database.db
      .select({ value: count() })
      .from(channelConnections)
      .where(eq(channelConnections.organizationId, organizationId))
    const [validationAudit] = await database.db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.organizationId, organizationId))
    expect(connectionCount?.value).toBe(0)
    expect(validationAudit?.eventType).toBe(
      "channel_connection.validation_failed"
    )
    expect(JSON.stringify(validationAudit)).not.toContain(authToken)
  })

  it("does not provision archived Organizations", async () => {
    const organizationId = await createOrganization("archived-channel")
    await database.db
      .update(organizations)
      .set({ status: "archived", archivedAt: new Date() })
      .where(eq(organizations.id, organizationId))
    const verifyWhatsAppSender = vi.spyOn(
      TwilioChannelProvider.prototype,
      "verifyWhatsAppSender"
    )
    const provision = provisionWhatsAppChannelConnection

    await expect(
      provision({
        organizationId,
        name: "Archived",
        address,
        accountSid: "AC44444444444444444444444444444444",
        authToken,
      })
    ).rejects.toThrow("Organization is not available")
    expect(verifyWhatsAppSender).not.toHaveBeenCalled()
  })

  it("resolves and signature-validates a provisioned webhook", async () => {
    const organizationId = await createOrganization("signed-webhook")
    vi.spyOn(
      TwilioChannelProvider.prototype,
      "verifyWhatsAppSender"
    ).mockResolvedValue({
      externalSenderId: "XE33333333333333333333333333333333",
    })
    const provision = provisionWhatsAppChannelConnection
    const connection = await provision({
      organizationId,
      name: "Signed",
      address,
      accountSid: "AC33333333333333333333333333333333",
      authToken,
    })
    const url = "https://api.example.com/webhooks/twilio/whatsapp/inbound"
    const form = {
      MessageSid: "SM33333333333333333333333333333333",
      AccountSid: "AC33333333333333333333333333333333",
      To: `whatsapp:${address}`,
      From: "whatsapp:+5511888888888",
      Body: "Hello",
      NumMedia: "0",
    }
    const signature = twilio.getExpectedTwilioSignature(authToken, url, form)
    ingestInboundMessage.mockResolvedValue({
      ok: true,
      value: {
        organizationId,
        channelConnectionId: connection.channelConnectionId,
        contactId: createId(),
        channelIdentityId: createId(),
        supportConversationId: createId(),
        messageId: createId(),
        duplicate: false,
        jobId: "job-id",
      },
    })

    await expect(
      processTwilioInboundMessage({
        signature,
        url,
        form,
        receivedAt: new Date(),
      })
    ).resolves.toMatchObject({ ok: true })
    expect(ingestInboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        channelConnectionId: connection.channelConnectionId,
      })
    )
    await expect(
      processTwilioInboundMessage({
        signature: "invalid",
        url,
        form,
        receivedAt: new Date(),
      })
    ).resolves.toEqual({
      ok: false,
      error: { type: "rejected", reason: "invalid_signature" },
    })
    await expect(
      processTwilioInboundMessage({
        signature,
        url,
        form: { ...form, Body: "Tampered" },
        receivedAt: new Date(),
      })
    ).resolves.toEqual({
      ok: false,
      error: { type: "rejected", reason: "invalid_signature" },
    })
    await expect(
      processTwilioInboundMessage({
        signature: twilio.getExpectedTwilioSignature("wrong-token", url, form),
        url,
        form,
        receivedAt: new Date(),
      })
    ).resolves.toEqual({
      ok: false,
      error: { type: "rejected", reason: "invalid_signature" },
    })
    await expect(
      processTwilioInboundMessage({
        signature,
        url,
        form: {
          ...form,
          AccountSid: "AC99999999999999999999999999999999",
        },
        receivedAt: new Date(),
      })
    ).resolves.toEqual({
      ok: false,
      error: { type: "rejected", reason: "unknown_connection" },
    })

    const invalidSignatureAudits = await database.db
      .select()
      .from(auditEvents)
      .where(
        eq(
          auditEvents.eventType,
          "channel_connection.webhook_signature_invalid"
        )
      )
    expect(invalidSignatureAudits).toHaveLength(3)
  })
})
