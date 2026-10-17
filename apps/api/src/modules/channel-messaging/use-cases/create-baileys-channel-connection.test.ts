import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  encrypt,
  enqueue,
  findForOrganization,
  publish,
  savePendingBaileysConnection,
} = vi.hoisted(() => ({
  encrypt: vi.fn(),
  enqueue: vi.fn(),
  findForOrganization: vi.fn(),
  publish: vi.fn(),
  savePendingBaileysConnection: vi.fn(),
}))

vi.mock("../twilio-inbound-webhook-url", () => ({
  twilioInboundWebhookUrl: () =>
    "http://localhost:3001/webhooks/twilio/whatsapp/inbound",
}))
vi.mock("../adapters/channel-credentials-cipher", () => ({
  credentialsCipher: { encrypt },
}))
vi.mock("@/lib/jobs-client", () => ({
  jobs: { enqueue },
}))
vi.mock("../events/publish-channel-status-changed", () => ({
  publishChannelStatusChanged: publish,
}))
vi.mock("../repositories/channel-connections-repository", () => ({
  ChannelRoutingConflictError: class ChannelRoutingConflictError extends Error {},
  OrganizationNotActiveError: class OrganizationNotActiveError extends Error {},
  channelConnectionsRepository: {
    savePendingBaileysConnection,
    findForOrganization,
  },
}))

import { createBaileysChannelConnection } from "./create-baileys-channel-connection"

const organizationId = "01K1EDN69NFBWCG42B2H99V2C1"
const firstChannelConnectionId = "01K1EDN9C8VT0N8WRM13RM6M55"
const secondChannelConnectionId = "01K1EDN9C8VT0N8WRM13RM6M56"

const pendingConnection = (id: string, displayName: string) => ({
  id,
  channelType: "whatsapp" as const,
  provider: "baileys" as const,
  name: displayName,
  displayName,
  address: null,
  status: "pending" as const,
  inboxId: null,
  updatedAt: new Date("2026-10-12T12:00:00.000Z"),
  deletable: true,
  session: {
    state: "connecting" as const,
    lastError: null,
    lastConnectedAt: null,
    lastSeenAt: null,
  },
})

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
        displayName: string
        encryptCredentials: (id: string) => { ciphertext: string }
      }) => {
        const id =
          input.displayName === "QR A"
            ? firstChannelConnectionId
            : secondChannelConnectionId
        const encrypted = input.encryptCredentials(id)
        expect(JSON.stringify(encrypted)).not.toContain("baileys-secret")
        return { channelConnectionId: id }
      }
    )
    findForOrganization.mockImplementation(
      async (_organizationId: string, channelConnectionId: string) => {
        if (channelConnectionId === firstChannelConnectionId) {
          return pendingConnection(firstChannelConnectionId, "QR A")
        }
        return pendingConnection(secondChannelConnectionId, "QR B")
      }
    )
    enqueue.mockResolvedValue({ id: "connect-job" })
    publish.mockResolvedValue(undefined)
  })

  it("stores a pending connection and asks the gateway to connect", async () => {
    const result = await createBaileysChannelConnection({
      organizationId,
      operatorUserId: "user-id",
      displayName: "QR A",
      inboxId: null,
    })

    expect(result.ok).toBe(true)
    expect(enqueue).toHaveBeenCalledWith("wa-connect", {
      organizationId,
      channelConnectionId: firstChannelConnectionId,
    })
    expect(publish).toHaveBeenCalled()
    expect(encrypt).toHaveBeenCalledWith("baileys", {
      organizationId,
      channelConnectionId: firstChannelConnectionId,
      provider: "baileys",
    })
  })

  it("allows multiple pending Baileys connections for the same organization", async () => {
    const first = await createBaileysChannelConnection({
      organizationId,
      operatorUserId: "user-id",
      displayName: "QR A",
      inboxId: null,
    })
    const second = await createBaileysChannelConnection({
      organizationId,
      operatorUserId: "user-id",
      displayName: "QR B",
      inboxId: null,
    })

    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    expect(savePendingBaileysConnection).toHaveBeenCalledTimes(2)
    expect(enqueue).toHaveBeenCalledTimes(2)
  })
})
