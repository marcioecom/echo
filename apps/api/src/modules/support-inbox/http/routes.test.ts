import websocket from "@fastify/websocket"
import Fastify from "fastify"
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { supportInboxEventBroker } from "../events/support-inbox-event-broker"
import { encodeSupportInboxCursor } from "../schemas"
import { registerSupportInboxRoutes } from "./routes"

const {
  authState,
  conversationId,
  findDetail,
  findMessageMedia,
  guards,
  list,
  messageId,
  organizationId,
  presignGet,
} = vi.hoisted(() => {
  const authState = { unauthenticated: false }
  type RequestAuth = {
    user?: unknown
    member?: unknown
    organization?: unknown
  }

  const requireUser = async (
    request: { auth: RequestAuth | null },
    reply: {
      code: (statusCode: number) => { send: (payload: unknown) => void }
    }
  ) => {
    if (authState.unauthenticated) {
      reply.code(401).send({ error: "unauthenticated" })
      return
    }
    request.auth = {
      user: {
        id: "user-id",
        name: "Operator",
        email: "operator@test.dev",
      },
      member: null,
      organization: null,
    }
  }
  const requireMembership =
    () => async (request: { auth: RequestAuth | null }) => {
      const user = request.auth?.user
      if (!user) return

      request.auth = {
        user,
        member: { id: "member-id", role: "operator" },
        organization: { id: organizationId, name: "Acme", slug: "acme" },
      }
    }

  return {
    authState,
    conversationId: "01K1EDN69NFBWCG42B2H99V2C4",
    findDetail: vi.fn(),
    findMessageMedia: vi.fn(),
    guards: {
      requireUser,
      requireMembership,
      requireOrganization: () => [requireUser, requireMembership()],
    },
    list: vi.fn(),
    messageId: "01K1EDN69NFBWCG42B2H99V2C5",
    organizationId: "01K1EDN69NFBWCG42B2H99V2C1",
    presignGet: vi.fn(),
  }
})

vi.mock("../repositories/support-inbox-repository", () => ({
  supportInboxRepository: { findDetail, findMessageMedia, list },
}))
vi.mock("../../../lib/object-store", () => ({
  objectStore: { presignGet },
}))
vi.mock("../../../config/env", () => ({
  env: { WEB_APP_URL: "http://localhost:3000" },
}))
vi.mock("../../../plugins/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../plugins/auth")>()),
  guards,
}))

async function createTestApp(options?: { unauthenticated?: boolean }) {
  authState.unauthenticated = options?.unauthenticated ?? false
  const app = Fastify()
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)
  await app.register(websocket)
  app.decorateRequest("auth", null)
  registerSupportInboxRoutes(app)
  await app.ready()
  return app
}

describe("Support Inbox routes", () => {
  beforeEach(() => vi.clearAllMocks())

  it("rejects unauthenticated list requests", async () => {
    const app = await createTestApp({ unauthenticated: true })
    const response = await app.inject({
      method: "GET",
      url: "/v1/support-conversations",
    })

    expect(response.statusCode).toBe(401)
    expect(list).not.toHaveBeenCalled()
    await app.close()
  })

  it("derives the tenant and status filter from authenticated context", async () => {
    list.mockResolvedValue({
      items: [
        {
          id: conversationId,
          status: "human_required",
          contact: {
            displayName: "Ana",
            address: "+5511999999999",
            channelType: "whatsapp",
          },
          lastActivityAt: new Date("2026-08-02T12:00:00.000Z"),
          lastMessage: {
            preview: "I need help",
            senderType: "contact",
            contentType: "text",
            transcriptStatus: null,
          },
        },
      ],
      hasMore: false,
    })
    const app = await createTestApp()
    const response = await app.inject({
      method: "GET",
      url: "/v1/support-conversations?status=human_required",
    })

    expect(response.statusCode).toBe(200)
    expect(list).toHaveBeenCalledWith({
      organizationId,
      status: "human_required",
      cursor: undefined,
      limit: 10,
    })
    expect(response.json()).toMatchObject({
      items: [
        { id: conversationId, lastActivityAt: "2026-08-02T12:00:00.000Z" },
      ],
      nextCursor: null,
    })
    await app.close()
  })

  it("passes a decoded cursor to the repository", async () => {
    list.mockResolvedValue({ items: [], hasMore: false })
    const cursor = encodeSupportInboxCursor({
      lastActivityAt: new Date("2026-08-02T12:00:00.000Z"),
      id: conversationId,
    })
    const app = await createTestApp()
    const response = await app.inject({
      method: "GET",
      url: `/v1/support-conversations?cursor=${cursor}`,
    })

    expect(response.statusCode).toBe(200)
    expect(list).toHaveBeenCalledWith({
      organizationId,
      status: undefined,
      cursor: {
        lastActivityAt: new Date("2026-08-02T12:00:00.000Z"),
        id: conversationId,
      },
      limit: 10,
    })
    await app.close()
  })

  it("rejects an invalid cursor before querying the repository", async () => {
    const app = await createTestApp()
    const response = await app.inject({
      method: "GET",
      url: "/v1/support-conversations?cursor=invalid",
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({ error: "invalid_cursor" })
    expect(list).not.toHaveBeenCalled()
    await app.close()
  })

  it("qualifies detail lookup by the authenticated Organization", async () => {
    findDetail.mockResolvedValue(null)
    const app = await createTestApp()
    const response = await app.inject({
      method: "GET",
      url: `/v1/support-conversations/${conversationId}`,
    })

    expect(response.statusCode).toBe(404)
    expect(findDetail).toHaveBeenCalledWith({ organizationId, conversationId })
    await app.close()
  })

  it("returns a signed media URL for stored audio inside the tenant", async () => {
    const objectKey = "organizations/acme/inbound/audio.ogg"
    findMessageMedia.mockResolvedValue({
      objectKey,
      mimeType: "audio/ogg",
      durationMs: 4200,
    })
    presignGet.mockResolvedValue({
      url: "https://storage.example/audio.ogg?signature=abc",
      expiresAt: new Date("2026-08-02T12:05:00.000Z"),
    })
    const app = await createTestApp()
    const response = await app.inject({
      method: "GET",
      url: `/v1/support-conversations/${conversationId}/messages/${messageId}/media`,
    })

    expect(response.statusCode).toBe(200)
    expect(findMessageMedia).toHaveBeenCalledWith({
      organizationId,
      conversationId,
      messageId,
    })
    expect(presignGet).toHaveBeenCalledWith({ key: objectKey, expiresIn: 300 })
    expect(response.json()).toEqual({
      url: "https://storage.example/audio.ogg?signature=abc",
      expiresAt: "2026-08-02T12:05:00.000Z",
      mimeType: "audio/ogg",
      durationMs: 4200,
    })
    await app.close()
  })

  it("returns 404 when media is pending or belongs to another tenant", async () => {
    findMessageMedia.mockResolvedValue(null)
    const app = await createTestApp()
    const response = await app.inject({
      method: "GET",
      url: `/v1/support-conversations/${conversationId}/messages/${messageId}/media`,
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({ error: "message_media_not_found" })
    expect(presignGet).not.toHaveBeenCalled()
    await app.close()
  })

  it("rejects unauthenticated WebSocket upgrades", async () => {
    const app = await createTestApp({ unauthenticated: true })

    await expect(
      app.injectWS("/v1/support-conversations/events", {
        headers: { origin: "http://localhost:3000" },
      })
    ).rejects.toThrow()
    await app.close()
  })

  it("rejects WebSocket upgrades from another origin", async () => {
    const app = await createTestApp()

    await expect(
      app.injectWS("/v1/support-conversations/events", {
        headers: { origin: "https://untrusted.example" },
      })
    ).rejects.toThrow()
    await app.close()
  })

  it("delivers tenant events through an authenticated WebSocket", async () => {
    const app = await createTestApp()
    const socket = await app.injectWS("/v1/support-conversations/events", {
      headers: { origin: "http://localhost:3000" },
    })
    const received = new Promise<string>((resolve) => {
      socket.once("message", (message) => resolve(message.toString()))
    })

    supportInboxEventBroker.publish(organizationId, {
      type: "support_conversation.updated",
      conversationId,
    })

    await expect(received).resolves.toBe(
      JSON.stringify({
        type: "support_conversation.updated",
        conversationId,
      })
    )
    socket.terminate()
    await app.close()
  })
})
