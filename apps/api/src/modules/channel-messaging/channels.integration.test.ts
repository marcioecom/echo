import { resolve } from "node:path"

import { PostgreSqlContainer } from "@testcontainers/postgresql"
import type { createDatabase } from "@workspace/db"
import {
  channelConnectionProviderBindings,
  channelConnections,
  channelSessionStates,
} from "@workspace/db/schema"
import { inboxEventChannel, parseInboxEvent } from "@workspace/jobs"
import { ChannelCredentialsCipher } from "@workspace/messaging"
import { and, eq, sql } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import type { Redis } from "ioredis"
import { GenericContainer } from "testcontainers"
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import type { createApp } from "@/app"

const encryptionKey = Buffer.alloc(32, 7).toString("base64")
const authToken = "twilio-auth-token"

function extractCookies(
  headers: Record<string, string | string[] | number | undefined>
): string {
  const raw = headers["set-cookie"]
  const setCookies = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? [raw]
      : undefined
  if (!setCookies) return ""
  return setCookies.map((cookie) => cookie.split(";")[0]).join("; ")
}

describe("channel connection API", () => {
  const postgresContainer = new PostgreSqlContainer("pgvector/pgvector:pg18")
  const redisContainer = new GenericContainer(
    "redis:7.4-alpine"
  ).withExposedPorts(6379)

  let app: ReturnType<typeof createApp>
  let database: ReturnType<typeof createDatabase>
  let redis: Redis
  let verifyWhatsAppSender: ReturnType<typeof vi.spyOn>
  let configurationError: typeof import("@workspace/messaging").TwilioConfigurationError
  let stopPostgres: () => Promise<void>
  let stopRedis: () => Promise<void>

  beforeAll(async () => {
    const [postgres, redisService] = await Promise.all([
      postgresContainer.start(),
      redisContainer.start(),
    ])
    stopPostgres = () => postgres.stop().then(() => undefined)
    stopRedis = () => redisService.stop().then(() => undefined)

    vi.stubEnv("DATABASE_URL", postgres.getConnectionUri())
    vi.stubEnv(
      "REDIS_URL",
      `redis://${redisService.getHost()}:${redisService.getMappedPort(6379)}`
    )
    vi.stubEnv("DEPENDENCY_TIMEOUT_MS", "10000")
    vi.stubEnv("AI_GATEWAY_API_KEY", "integration-gateway-key")
    vi.stubEnv("API_HOST", "127.0.0.1")
    vi.stubEnv("API_PORT", "3001")
    vi.stubEnv("NODE_ENV", "test")
    vi.stubEnv("LOG_LEVEL", "silent")
    vi.stubEnv("BETTER_AUTH_SECRET", "integration-test-secret-integration-test")
    vi.stubEnv("CHANNEL_CREDENTIALS_ENCRYPTION_KEY", encryptionKey)
    vi.stubEnv("CHANNEL_CREDENTIALS_KEY_VERSION", "v1")
    vi.stubEnv("PUBLIC_API_URL", "http://localhost:3001")
    vi.stubEnv("WEB_APP_URL", "http://localhost:3000")
    vi.stubEnv("EMAIL_ASSET_BASE_URL", "https://assets.echo.test")
    vi.stubEnv("R2_ENDPOINT", "https://r2.echo.test")
    vi.stubEnv("R2_BUCKET_NAME", "echo-storage")
    vi.stubEnv("R2_ACCESS_KEY_ID", "test-access-key")
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "test-secret-key")
    vi.stubEnv(
      "KNOWLEDGE_UPLOAD_TOKEN_SECRET",
      "knowledge-upload-token-secret-at-least-32"
    )

    vi.resetModules()
    const [appModule, dbModule, redisModule, messagingModule] =
      await Promise.all([
        import("../../app"),
        import("../../lib/db"),
        import("../../lib/redis"),
        import("@workspace/messaging"),
      ])
    app = appModule.createApp()
    database = dbModule.database
    redis = redisModule.redisConnection
    verifyWhatsAppSender = vi.spyOn(
      messagingModule.TwilioChannelProvider.prototype,
      "verifyWhatsAppSender"
    )
    configurationError = messagingModule.TwilioConfigurationError
    await database.db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`)
    await migrate(database.db, {
      migrationsFolder: resolve(process.cwd(), "../../packages/db/migrations"),
    })
  }, 120_000)

  afterAll(async () => {
    await Promise.allSettled([
      app?.close(),
      database?.close(),
      redis?.quit(),
      stopPostgres?.(),
      stopRedis?.(),
    ])
    vi.unstubAllEnvs()
  })

  beforeEach(() => {
    verifyWhatsAppSender.mockReset()
    verifyWhatsAppSender.mockResolvedValue({
      externalSenderId: "XE11111111111111111111111111111111",
    })
  })

  async function signUp(email: string, name: string): Promise<string> {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      payload: { email, name, password: "password123" },
    })
    expect(response.statusCode).toBe(200)
    return extractCookies(response.headers)
  }

  async function createOrganization(
    cookies: string,
    name: string,
    slug: string
  ) {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/organization/create",
      headers: { cookie: cookies },
      payload: { name, slug },
    })
    expect(response.statusCode).toBe(200)
    return response.json() as { id: string }
  }

  async function pairBaileysConnection(
    organizationId: string,
    channelConnectionId: string,
    address: string
  ): Promise<void> {
    const userJid = `${address.replace("+", "")}@s.whatsapp.net`
    await database.db.transaction(async (transaction) => {
      await transaction
        .update(channelConnections)
        .set({ address, status: "active" })
        .where(
          and(
            eq(channelConnections.organizationId, organizationId),
            eq(channelConnections.id, channelConnectionId)
          )
        )
      await transaction
        .update(channelConnectionProviderBindings)
        .set({
          routingAddress: address,
          externalAccountId: address,
          externalSenderId: userJid,
        })
        .where(
          and(
            eq(channelConnectionProviderBindings.organizationId, organizationId),
            eq(
              channelConnectionProviderBindings.channelConnectionId,
              channelConnectionId
            )
          )
        )
      await transaction
        .update(channelSessionStates)
        .set({
          state: "connected",
          lastError: null,
          lastConnectedAt: new Date(),
          lastSeenAt: new Date(),
        })
        .where(
          and(
            eq(channelSessionStates.organizationId, organizationId),
            eq(channelSessionStates.channelConnectionId, channelConnectionId)
          )
        )
    })
  }

  function isUniqueViolation(error: unknown): boolean {
    if (!error || typeof error !== "object") return false
    if ("code" in error && error.code === "23505") return true
    return "cause" in error && isUniqueViolation(error.cause)
  }

  function channelPayload(suffix: string, inboxId?: string) {
    return {
      provider: "twilio",
      displayName: `Suporte ${suffix}`,
      address: `+551199999${suffix}`,
      accountSid: `AC${suffix}${"1".repeat(32)}`.slice(0, 34),
      authToken,
      ...(inboxId ? { inboxId } : {}),
    }
  }

  it("creates, lists, updates, and soft-deletes Twilio channels for the organization", async () => {
    const ownerCookies = await signUp("channels-owner@acme.test", "Owner")
    const organization = await createOrganization(
      ownerCookies,
      "Channels Acme",
      "channels-acme"
    )
    const subscriber = redis.duplicate()
    const event = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("timed out waiting for channel.status_changed")),
        5_000
      )
      subscriber.on("message", (_channel, message) => {
        clearTimeout(timer)
        resolve(message)
      })
    })
    await subscriber.subscribe(inboxEventChannel(organization.id))

    const unauthenticated = await app.inject({
      method: "GET",
      url: "/v1/channels",
    })
    expect(unauthenticated.statusCode).toBe(401)

    const firstPayload = {
      provider: "twilio",
      displayName: "Suporte principal",
      address: "+5511988887777",
      accountSid: "AC11111111111111111111111111111111",
      authToken,
      inboxId: "geral",
    }
    const created = await app.inject({
      method: "POST",
      url: "/v1/channels",
      headers: { cookie: ownerCookies },
      payload: firstPayload,
    })
    expect(created.statusCode).toBe(201)
    const createdBody = created.json() as {
      channel: {
        id: string
        displayName: string
        inboxId: string
        status: string
        webhookUrl: string
        address: string
      }
    }
    expect(created.body).not.toContain(authToken)
    expect(createdBody.channel).toMatchObject({
      displayName: "Suporte principal",
      inboxId: "geral",
      status: "active",
      address: "+5511988887777",
      webhookUrl: "http://localhost:3001/webhooks/twilio/whatsapp/inbound",
    })
    expect(verifyWhatsAppSender).toHaveBeenCalledWith({
      address: "+5511988887777",
      sandbox: false,
    })

    const published = parseInboxEvent(
      inboxEventChannel(organization.id),
      await event
    )
    expect(published).toEqual({
      organizationId: organization.id,
      event: {
        type: "channel.status_changed",
        channelConnectionId: createdBody.channel.id,
      },
    })
    await subscriber.quit()

    const second = await app.inject({
      method: "POST",
      url: "/v1/channels",
      headers: { cookie: ownerCookies },
      payload: {
        provider: "twilio",
        displayName: "Loja centro",
        address: "+5511977776666",
        accountSid: "AC22222222222222222222222222222222",
        authToken: "second-token",
      },
    })
    expect(second.statusCode).toBe(201)

    const listed = await app.inject({
      method: "GET",
      url: "/v1/channels",
      headers: { cookie: ownerCookies },
    })
    expect(listed.statusCode).toBe(200)
    const items = (
      listed.json() as { items: Array<{ id: string; status: string }> }
    ).items
    expect(items).toHaveLength(2)
    expect(items.every((item) => item.status === "active")).toBe(true)

    const [binding] = await database.db
      .select()
      .from(channelConnectionProviderBindings)
      .where(
        eq(
          channelConnectionProviderBindings.channelConnectionId,
          createdBody.channel.id
        )
      )
    expect(binding?.credentialsCiphertext).toBeTruthy()
    expect(JSON.stringify(binding)).not.toContain(authToken)
    const cipher = new ChannelCredentialsCipher({
      encryptionKey,
      keyVersion: "v1",
    })
    expect(
      cipher.decrypt(
        {
          ciphertext: binding!.credentialsCiphertext,
          nonce: binding!.credentialsNonce,
          authTag: binding!.credentialsAuthTag,
          keyVersion: binding!.credentialsKeyVersion,
        },
        {
          organizationId: organization.id,
          channelConnectionId: createdBody.channel.id,
          provider: "twilio",
        }
      )
    ).toBe(authToken)

    const [stored] = await database.db
      .select({
        displayName: channelConnections.displayName,
        inboxId: channelConnections.inboxId,
      })
      .from(channelConnections)
      .where(eq(channelConnections.id, createdBody.channel.id))
    expect(stored).toEqual({
      displayName: "Suporte principal",
      inboxId: "geral",
    })

    const otherCookies = await signUp("channels-other@acme.test", "Other")
    await createOrganization(otherCookies, "Other Org", "channels-other")
    const foreignList = await app.inject({
      method: "GET",
      url: "/v1/channels",
      headers: { cookie: otherCookies },
    })
    expect(foreignList.json()).toEqual({ items: [] })
    const foreignPatch = await app.inject({
      method: "PATCH",
      url: `/v1/channels/${createdBody.channel.id}`,
      headers: { cookie: otherCookies },
      payload: { displayName: "Roubado" },
    })
    expect(foreignPatch.statusCode).toBe(404)

    const renamed = await app.inject({
      method: "PATCH",
      url: `/v1/channels/${createdBody.channel.id}`,
      headers: { cookie: ownerCookies },
      payload: { displayName: "Suporte renomeado", inboxId: "loja" },
    })
    expect(renamed.statusCode).toBe(200)
    expect(renamed.json()).toMatchObject({
      channel: { displayName: "Suporte renomeado", inboxId: "loja" },
    })

    const removed = await app.inject({
      method: "DELETE",
      url: `/v1/channels/${createdBody.channel.id}`,
      headers: { cookie: ownerCookies },
    })
    expect(removed.statusCode).toBe(204)
    const [deleted] = await database.db
      .select({ id: channelConnections.id })
      .from(channelConnections)
      .where(eq(channelConnections.id, createdBody.channel.id))
    expect(deleted).toBeUndefined()
    const [deletedBinding] = await database.db
      .select({ id: channelConnectionProviderBindings.id })
      .from(channelConnectionProviderBindings)
      .where(
        eq(
          channelConnectionProviderBindings.channelConnectionId,
          createdBody.channel.id
        )
      )
    expect(deletedBinding).toBeUndefined()

    const invite = await app.inject({
      method: "POST",
      url: "/api/auth/organization/invite-member",
      headers: { cookie: ownerCookies },
      payload: { email: "channels-operator@acme.test", role: "operator" },
    })
    expect(invite.statusCode).toBe(200)
    const invitation = invite.json() as { id: string }
    const operatorCookies = await signUp(
      "channels-operator@acme.test",
      "Operator"
    )
    const accept = await app.inject({
      method: "POST",
      url: "/api/auth/organization/accept-invitation",
      headers: { cookie: operatorCookies },
      payload: { invitationId: invitation.id },
    })
    expect(accept.statusCode).toBe(200)
    const setActive = await app.inject({
      method: "POST",
      url: "/api/auth/organization/set-active",
      headers: { cookie: operatorCookies },
      payload: { organizationId: organization.id },
    })
    expect(setActive.statusCode).toBe(200)
    const forbidden = await app.inject({
      method: "GET",
      url: "/v1/channels",
      headers: { cookie: operatorCookies },
    })
    expect(forbidden.statusCode).toBe(403)
  })

  it("allows multiple Baileys connections, independent reactivation, and rejects duplicate numbers", async () => {
    const ownerCookies = await signUp("baileys-multi@acme.test", "Owner")
    const organization = await createOrganization(
      ownerCookies,
      "Baileys Multi",
      "baileys-multi"
    )

    const createFirst = await app.inject({
      method: "POST",
      url: "/v1/channels",
      headers: { cookie: ownerCookies },
      payload: { provider: "baileys", displayName: "Linha A" },
    })
    const createSecond = await app.inject({
      method: "POST",
      url: "/v1/channels",
      headers: { cookie: ownerCookies },
      payload: { provider: "baileys", displayName: "Linha B" },
    })
    expect(createFirst.statusCode).toBe(201)
    expect(createSecond.statusCode).toBe(201)

    const firstId = (createFirst.json() as { channel: { id: string } }).channel
      .id
    const secondId = (createSecond.json() as { channel: { id: string } }).channel
      .id
    expect(firstId).not.toBe(secondId)

    const listed = await app.inject({
      method: "GET",
      url: "/v1/channels",
      headers: { cookie: ownerCookies },
    })
    expect(listed.statusCode).toBe(200)
    const baileysItems = (
      listed.json() as {
        items: Array<{ id: string; provider: string; status: string }>
      }
    ).items.filter((item) => item.provider === "baileys")
    expect(baileysItems).toHaveLength(2)
    expect(baileysItems.every((item) => item.status === "pending")).toBe(true)

    const addressA = "+5511988811111"
    const addressB = "+5511988822222"
    await pairBaileysConnection(organization.id, firstId, addressA)
    await pairBaileysConnection(organization.id, secondId, addressB)

    const bindings = await database.db
      .select({
        channelConnectionId:
          channelConnectionProviderBindings.channelConnectionId,
        routingAddress: channelConnectionProviderBindings.routingAddress,
      })
      .from(channelConnectionProviderBindings)
      .where(
        eq(channelConnectionProviderBindings.organizationId, organization.id)
      )
    expect(bindings).toEqual(
      expect.arrayContaining([
        { channelConnectionId: firstId, routingAddress: addressA },
        { channelConnectionId: secondId, routingAddress: addressB },
      ])
    )

    await expect(
      pairBaileysConnection(organization.id, secondId, addressA)
    ).rejects.toSatisfy(isUniqueViolation)

    const disabled = await app.inject({
      method: "PATCH",
      url: `/v1/channels/${firstId}`,
      headers: { cookie: ownerCookies },
      payload: { status: "disabled" },
    })
    expect(disabled.statusCode).toBe(200)

    const afterDisable = await app.inject({
      method: "GET",
      url: "/v1/channels",
      headers: { cookie: ownerCookies },
    })
    const byId = new Map(
      (
        afterDisable.json() as {
          items: Array<{ id: string; status: string; address: string | null }>
        }
      ).items.map((item) => [item.id, item])
    )
    expect(byId.get(firstId)).toMatchObject({ status: "disabled" })
    expect(byId.get(secondId)).toMatchObject({
      status: "active",
      address: addressB,
    })

    const reactivated = await app.inject({
      method: "PATCH",
      url: `/v1/channels/${firstId}`,
      headers: { cookie: ownerCookies },
      payload: { status: "active" },
    })
    expect(reactivated.statusCode).toBe(200)
    expect(reactivated.json()).toMatchObject({
      channel: { id: firstId, status: "pending" },
    })

    const afterReactivate = await app.inject({
      method: "GET",
      url: "/v1/channels",
      headers: { cookie: ownerCookies },
    })
    const secondAfter = (
      afterReactivate.json() as {
        items: Array<{ id: string; status: string; address: string | null }>
      }
    ).items.find((item) => item.id === secondId)
    expect(secondAfter).toMatchObject({
      status: "active",
      address: addressB,
    })
  })

  it("refuses invalid Twilio credentials before saving", async () => {
    const ownerCookies = await signUp("channels-invalid@acme.test", "Owner")
    await createOrganization(
      ownerCookies,
      "Invalid Channels",
      "channels-invalid"
    )
    verifyWhatsAppSender.mockRejectedValueOnce(
      new configurationError("sender_not_found")
    )

    const response = await app.inject({
      method: "POST",
      url: "/v1/channels",
      headers: { cookie: ownerCookies },
      payload: channelPayload("3333"),
    })

    expect(response.statusCode).toBe(422)
    expect(response.json()).toEqual({
      error: "twilio_verification_failed",
      reason: "sender_not_found",
    })
    expect(response.body).not.toContain(authToken)

    const session = await app.inject({
      method: "GET",
      url: "/api/auth/get-session",
      headers: { cookie: ownerCookies },
    })
    const organizationId = (
      session.json() as { session: { activeOrganizationId: string } }
    ).session.activeOrganizationId
    const rows = await database.db
      .select({ id: channelConnections.id })
      .from(channelConnections)
      .where(eq(channelConnections.organizationId, organizationId))
    expect(rows).toEqual([])
  })
})
