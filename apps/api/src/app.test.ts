import { beforeEach, describe, expect, it, vi } from "vitest"

const { processTwilioInboundMessage, postgres, redis } = vi.hoisted(() => ({
  processTwilioInboundMessage: vi.fn(),
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
    EMAIL_ASSET_BASE_URL: "https://assets.echo.test",
  },
}))
vi.mock("./lib/db", () => ({ database: { check: postgres, db: {} } }))
vi.mock("./lib/jobs-client", () => ({ jobs: { enqueue: vi.fn() } }))
vi.mock("./lib/redis", () => ({ pingRedis: redis }))
vi.mock("./modules/auth/auth", () => ({ auth: {} }))
vi.mock(
  "./modules/channel-messaging/use-cases/process-twilio-inbound-message",
  () => ({
    processTwilioInboundMessage,
  })
)

import { createApp } from "./app"

describe("API health", () => {
  beforeEach(() => {
    postgres.mockReset()
    redis.mockReset()
    processTwilioInboundMessage.mockReset()
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

  it("wires inbound Messages to the module use case", async () => {
    processTwilioInboundMessage.mockResolvedValue({
      ok: true,
      value: {
        organizationId: "01K1EDN69NFBWCG42B2H99V2C1",
        contactId: "01K1EDN69NFBWCG42B2H99V2C2",
        channelIdentityId: "01K1EDN69NFBWCG42B2H99V2C3",
        supportConversationId: "01K1EDN69NFBWCG42B2H99V2C4",
        messageId: "01K1EDN69NFBWCG42B2H99V2C5",
        duplicate: false,
        jobId: "process-inbound-message--01K1EDN69NFBWCG42B2H99V2C4",
      },
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
    expect(processTwilioInboundMessage).toHaveBeenCalledOnce()
    await app.close()
  })

})
