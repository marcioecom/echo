import { beforeEach, describe, expect, it, vi } from "vitest"

const { authenticateWebhook, ingestInboundMessage, postgres, redis } =
  vi.hoisted(() => ({
    authenticateWebhook: vi.fn(),
    ingestInboundMessage: vi.fn(),
    postgres: vi.fn(),
    redis: vi.fn(),
  }))

vi.mock("./config/env", () => ({
  env: {
    LOG_LEVEL: "silent",
    NODE_ENV: "test",
    CHANNEL_CREDENTIALS_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
    CHANNEL_CREDENTIALS_KEY_VERSION: "v1",
    PUBLIC_API_URL: "http://localhost:3001",
    WEB_APP_URL: "http://localhost:3000",
  },
}))
vi.mock("./lib/db", () => ({ database: { check: postgres, db: {} } }))
vi.mock("./lib/jobs-client", () => ({ jobs: { enqueue: vi.fn() } }))
vi.mock("./lib/redis", () => ({ pingRedis: redis }))
vi.mock("./modules/auth/auth", () => ({ auth: {} }))
vi.mock(
  "./modules/channel-connections/services/authenticate-twilio-webhook",
  () => ({
    createAuthenticateTwilioWebhook: () => authenticateWebhook,
    TwilioWebhookRejectedError: class extends Error {},
  })
)
vi.mock("./modules/messages/services/ingest-inbound-message", () => ({
  ingestInboundMessage,
  InboundMessageEnqueueError: class extends Error {},
}))

import { createApp } from "./app"

describe("API health", () => {
  beforeEach(() => {
    postgres.mockReset()
    redis.mockReset()
    authenticateWebhook.mockReset()
    ingestInboundMessage.mockReset()
  })

  it("separates liveness from dependency readiness", async () => {
    postgres.mockResolvedValue(undefined)
    redis.mockRejectedValue(new Error("unavailable"))
    const app = createApp()

    const live = await app.inject({ method: "GET", url: "/health/live" })
    const ready = await app.inject({ method: "GET", url: "/health/ready" })

    expect(live.statusCode).toBe(200)
    expect(ready.statusCode).toBe(503)
    expect(ready.json()).toEqual({
      status: "unavailable",
      dependencies: { postgres: "ok", redis: "unavailable" },
    })

    await app.close()
  })

  it("wires authenticated inbound Messages to ingestion", async () => {
    authenticateWebhook.mockImplementation(async ({ form }) => ({
      organizationId: "01K1EDN69NFBWCG42B2H99V2C1",
      channelConnectionId: "01K1EDN9C8VT0N8WRM13RM6M55",
      channelType: "whatsapp",
      address: "+5511999999999",
      form,
    }))
    ingestInboundMessage.mockResolvedValue({
      organizationId: "01K1EDN69NFBWCG42B2H99V2C1",
      channelIdentityId: "01K1EDN69NFBWCG42B2H99V2C2",
      supportConversationId: "01K1EDN69NFBWCG42B2H99V2C3",
      messageId: "01K1EDN69NFBWCG42B2H99V2C4",
      jobId: "process-inbound-message--01K1EDN69NFBWCG42B2H99V2C4",
    })
    const app = createApp()

    const response = await app.inject({
      method: "POST",
      url: "/webhooks/twilio/whatsapp/inbound",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-twilio-signature": "signature",
      },
      payload:
        "MessageSid=SM11111111111111111111111111111111&AccountSid=AC11111111111111111111111111111111&From=whatsapp%3A%2B5511888888888&To=whatsapp%3A%2B5511999999999&Body=Help&NumMedia=0",
    })

    expect(response.statusCode).toBe(200)
    expect(ingestInboundMessage).toHaveBeenCalledOnce()
    await app.close()
  })
})
