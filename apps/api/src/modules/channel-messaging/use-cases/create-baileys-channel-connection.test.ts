import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  BaileysSessionExistsError,
  encrypt,
  enqueue,
  findForOrganization,
  publish,
  savePendingBaileysConnection,
} = vi.hoisted(() => {
  class BaileysSessionExistsError extends Error {
    constructor() {
      super("exists")
      this.name = "BaileysSessionExistsError"
    }
  }
  return {
    BaileysSessionExistsError,
    encrypt: vi.fn(),
    enqueue: vi.fn(),
    findForOrganization: vi.fn(),
    publish: vi.fn(),
    savePendingBaileysConnection: vi.fn(),
  }
})

vi.mock("../twilio-inbound-webhook-url", () => ({
  twilioInboundWebhookUrl: () =>
    "http://localhost:3001/webhooks/twilio/whatsapp/inbound",
}))
vi.mock("../adapters/channel-credentials-cipher", () => ({
  credentialsCipher: { encrypt },
}))
vi.mock("@/lib/jobs-client", () => ({ jobs: { enqueue } }))
vi.mock("../events/publish-channel-status-changed", () => ({
  publishChannelStatusChanged: publish,
}))
vi.mock("../repositories/channel-connections-repository", () => ({
  BaileysSessionExistsError,
  ChannelRoutingConflictError: class ChannelRoutingConflictError extends Error {},
  OrganizationNotActiveError: class OrganizationNotActiveError extends Error {},
  channelConnectionsRepository: {
    savePendingBaileysConnection,
    findForOrganization,
  },
}))

import { createBaileysChannelConnection } from "./create-baileys-channel-connection"

const organizationId = "01K1EDN69NFBWCG42B2H99V2C1"
const channelConnectionId = "01K1EDN9C8VT0N8WRM13RM6M55"

describe("createBaileysChannelConnection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    encrypt.mockReturnValue({
      ciphertext: "cipher",
      nonce: "nonce",
      authTag: "tag",
      keyVersion: "v1",
    })
    savePendingBaileysConnection.mockImplementation(
      async (input: {
        encryptCredentials: (id: string) => { ciphertext: string }
      }) => {
        const encrypted = input.encryptCredentials(channelConnectionId)
        expect(JSON.stringify(encrypted)).not.toContain("baileys-secret")
        return { channelConnectionId }
      }
    )
    findForOrganization.mockResolvedValue({
      id: channelConnectionId,
      channelType: "whatsapp",
      provider: "baileys",
      name: "QR",
      displayName: "QR",
      address: null,
      status: "pending",
      inboxId: null,
      updatedAt: new Date("2026-10-12T12:00:00.000Z"),
      session: {
        state: "connecting",
        lastError: null,
        lastConnectedAt: null,
        lastSeenAt: null,
      },
    })
    enqueue.mockResolvedValue({ id: "connect-job" })
    publish.mockResolvedValue(undefined)
  })

  it("stores a pending connection and asks the gateway to connect", async () => {
    const result = await createBaileysChannelConnection({
      organizationId,
      operatorUserId: "user-id",
      displayName: "QR",
      inboxId: null,
    })

    expect(result.ok).toBe(true)
    expect(enqueue).toHaveBeenCalledWith("wa-connect", {
      organizationId,
      channelConnectionId,
    })
    expect(publish).toHaveBeenCalled()
    expect(encrypt).toHaveBeenCalledWith("baileys", {
      organizationId,
      channelConnectionId,
      provider: "baileys",
    })
  })

  it("rejects a second open Baileys session", async () => {
    savePendingBaileysConnection.mockRejectedValue(
      new BaileysSessionExistsError()
    )

    await expect(
      createBaileysChannelConnection({
        organizationId,
        operatorUserId: "user-id",
        displayName: "QR",
        inboxId: null,
      })
    ).resolves.toEqual({ ok: false, error: { type: "session_exists" } })
    expect(enqueue).not.toHaveBeenCalled()
  })
})
