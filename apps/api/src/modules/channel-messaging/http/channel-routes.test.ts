import Fastify from "fastify"
import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  authState,
  createTwilioChannelConnection,
  deleteChannelConnection,
  guards,
  listChannelConnections,
  organizationId,
  updateChannelConnection,
} = vi.hoisted(() => {
  const organizationId = "01K1EDN69NFBWCG42B2H99V2C1"
  const authState = { unauthenticated: false, role: "owner" }
  type RequestAuth = {
    user?: { id: string; name: string; email: string }
    member?: { id: string; role: string } | null
    organization?: { id: string; name: string; slug: string } | null
  }

  return {
    authState,
    organizationId,
    createTwilioChannelConnection: vi.fn(),
    deleteChannelConnection: vi.fn(),
    listChannelConnections: vi.fn(),
    updateChannelConnection: vi.fn(),
    guards: {
      requireUser: async (
        request: { auth: RequestAuth | null },
        reply: {
          code: (statusCode: number) => { send: (payload: unknown) => unknown }
        }
      ) => {
        if (authState.unauthenticated) {
          return reply.code(401).send({ error: "unauthenticated" })
        }
        request.auth = {
          user: { id: "user-id", name: "Owner", email: "owner@test.dev" },
          member: null,
          organization: null,
        }
      },
      requireMembership:
        (options?: { roles?: string[] }) =>
        async (
          request: { auth: RequestAuth | null },
          reply: {
            code: (statusCode: number) => {
              send: (payload: unknown) => unknown
            }
          }
        ) => {
          if (options?.roles && !options.roles.includes(authState.role)) {
            return reply.code(403).send({ error: "insufficient_role" })
          }
          const user = request.auth?.user
          if (!user) return
          request.auth = {
            user,
            member: { id: "member-id", role: authState.role },
            organization: { id: organizationId, name: "Acme", slug: "acme" },
          }
        },
    },
  }
})

vi.mock("../../../config/env", () => ({
  env: {
    DATABASE_URL: "postgres://localhost:5432/echo",
    REDIS_URL: "redis://localhost:6379",
    DEPENDENCY_TIMEOUT_MS: 1_000,
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
    WEB_APP_URL: "http://localhost:3000",
    EMAIL_ASSET_BASE_URL: "https://assets.echo.test",
    PUBLIC_API_URL: "http://localhost:3001",
    BETTER_AUTH_SECRET: "integration-test-secret-integration-test",
    CHANNEL_CREDENTIALS_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
    CHANNEL_CREDENTIALS_KEY_VERSION: "v1",
    R2_ENDPOINT: "https://r2.echo.test",
    R2_BUCKET_NAME: "echo-storage",
    R2_ACCESS_KEY_ID: "test-access-key",
    R2_SECRET_ACCESS_KEY: "test-secret-key",
    KNOWLEDGE_UPLOAD_TOKEN_SECRET: "knowledge-upload-token-secret-at-least-32",
  },
}))
vi.mock("../../../lib/db", () => ({
  database: { db: {}, close: async () => undefined },
}))
vi.mock("../../../lib/jobs-client", () => ({
  jobs: { enqueue: async () => ({ id: "job" }), close: async () => undefined },
}))
vi.mock("../../../lib/redis", () => ({
  redisConnection: { publish: async () => 0, quit: async () => undefined },
}))
vi.mock("../use-cases/create-twilio-channel-connection", () => ({
  createTwilioChannelConnection,
}))
vi.mock("../use-cases/delete-channel-connection", () => ({
  deleteChannelConnection,
}))
vi.mock("../use-cases/list-channel-connections", () => ({
  listChannelConnections,
}))
vi.mock("../use-cases/update-channel-connection", () => ({
  updateChannelConnection,
}))
vi.mock("../../../plugins/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../plugins/auth")>()),
  guards,
}))

import { registerChannelRoutes } from "./channel-routes"

const channelConnectionId = "01K1EDN69NFBWCG42B2H99V2C4"
const authToken = "super-secret-token"
const channel = {
  id: channelConnectionId,
  channelType: "whatsapp",
  provider: "twilio",
  name: "Suporte",
  displayName: "Suporte",
  address: "+5511999999999",
  status: "active",
  inboxId: null,
  webhookUrl: "http://localhost:3001/webhooks/twilio/whatsapp/inbound",
  session: null,
  updatedAt: "2026-10-12T12:00:00.000Z",
}

async function createTestApp() {
  const app = Fastify()
  app.decorateRequest("auth", null)
  registerChannelRoutes(app)
  await app.ready()
  return app
}

describe("channel routes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.unauthenticated = false
    authState.role = "owner"
    listChannelConnections.mockResolvedValue({ items: [channel] })
    createTwilioChannelConnection.mockResolvedValue({
      ok: true,
      value: channel,
    })
  })

  it("requires a signed-in admin", async () => {
    const app = await createTestApp()
    authState.unauthenticated = true
    const unauthenticated = await app.inject({
      method: "GET",
      url: "/v1/channels",
    })
    expect(unauthenticated.statusCode).toBe(401)

    authState.unauthenticated = false
    authState.role = "operator"
    const operator = await app.inject({ method: "GET", url: "/v1/channels" })
    expect(operator.statusCode).toBe(403)
    expect(operator.json()).toEqual({ error: "insufficient_role" })
    expect(listChannelConnections).not.toHaveBeenCalled()
    await app.close()
  })

  it("lists connections for the active Organization", async () => {
    const app = await createTestApp()
    const response = await app.inject({ method: "GET", url: "/v1/channels" })
    expect(response.statusCode).toBe(200)
    expect(listChannelConnections).toHaveBeenCalledWith(organizationId)
    expect(response.json()).toEqual({ items: [channel] })
    await app.close()
  })

  it("refuses invalid Twilio credentials with a clear error and hides the token", async () => {
    createTwilioChannelConnection.mockResolvedValue({
      ok: false,
      error: { type: "verification_failed", reason: "sender_not_found" },
    })
    const app = await createTestApp()
    const response = await app.inject({
      method: "POST",
      url: "/v1/channels",
      payload: {
        provider: "twilio",
        displayName: "Suporte",
        address: "+5511999999999",
        accountSid: "AC11111111111111111111111111111111",
        authToken,
      },
    })

    expect(response.statusCode).toBe(422)
    expect(response.json()).toEqual({
      error: "twilio_verification_failed",
      reason: "sender_not_found",
    })
    expect(response.body).not.toContain(authToken)
    expect(createTwilioChannelConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        operatorUserId: "user-id",
        authToken,
        inboxId: null,
      })
    )
    await app.close()
  })

  it("returns the webhook URL when Twilio accepts the number", async () => {
    const app = await createTestApp()
    const response = await app.inject({
      method: "POST",
      url: "/v1/channels",
      payload: {
        provider: "twilio",
        displayName: "Suporte",
        address: "+55 11 99999-9999",
        accountSid: "AC11111111111111111111111111111111",
        authToken,
        inboxId: "loja",
      },
    })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toEqual({ channel })
    expect(response.body).not.toContain(authToken)
    expect(createTwilioChannelConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        address: "+5511999999999",
        inboxId: "loja",
      })
    )
    await app.close()
  })

  it("updates the label and inbox, then soft-deletes", async () => {
    updateChannelConnection.mockResolvedValue({ ok: true, value: channel })
    deleteChannelConnection.mockResolvedValue({ ok: true, value: undefined })
    const app = await createTestApp()

    const updated = await app.inject({
      method: "PATCH",
      url: `/v1/channels/${channelConnectionId}`,
      payload: { displayName: "Loja", inboxId: "centro" },
    })
    expect(updated.statusCode).toBe(200)
    expect(updateChannelConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        channelConnectionId,
        displayName: "Loja",
        inboxId: "centro",
      })
    )

    const removed = await app.inject({
      method: "DELETE",
      url: `/v1/channels/${channelConnectionId}`,
    })
    expect(removed.statusCode).toBe(204)
    expect(deleteChannelConnection).toHaveBeenCalledWith({
      organizationId,
      channelConnectionId,
      operatorUserId: "user-id",
    })
    await app.close()
  })
})
