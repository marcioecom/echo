import { beforeEach, describe, expect, it, vi } from "vitest"

import { channelConnectionsRepository } from "../repositories/channel-connections-repository"
import { createTwilioChannelConnection } from "./create-twilio-channel-connection"
import { deleteChannelConnection } from "./delete-channel-connection"
import { updateChannelConnection } from "./update-channel-connection"

const {
  ChannelRoutingConflictError,
  OrganizationNotActiveError,
  TwilioConfigurationError,
  encrypt,
  findForOrganization,
  isOrganizationActive,
  publish,
  recordValidationFailure,
  saveManagedTwilioConnection,
  verifyWhatsAppSender,
} = vi.hoisted(() => {
  class TwilioConfigurationError extends Error {
    constructor(
      readonly reason:
        | "provider_request_failed"
        | "sender_not_found"
        | "sender_not_online"
        | "invalid_sandbox_address"
        | "account_not_active"
    ) {
      super(reason)
      this.name = "TwilioConfigurationError"
    }
  }
  class ChannelRoutingConflictError extends Error {
    constructor() {
      super("conflict")
      this.name = "ChannelRoutingConflictError"
    }
  }
  class OrganizationNotActiveError extends Error {
    constructor() {
      super("inactive")
      this.name = "OrganizationNotActiveError"
    }
  }
  return {
    ChannelRoutingConflictError,
    OrganizationNotActiveError,
    TwilioConfigurationError,
    encrypt: vi.fn(),
    findForOrganization: vi.fn(),
    isOrganizationActive: vi.fn(),
    publish: vi.fn(),
    recordValidationFailure: vi.fn(),
    saveManagedTwilioConnection: vi.fn(),
    verifyWhatsAppSender: vi.fn(),
  }
})

vi.mock("../adapters/channel-credentials-cipher", () => ({
  credentialsCipher: { encrypt },
}))
vi.mock("../adapters/twilio-channel-provider", () => ({
  TwilioChannelProvider: class {
    verifyWhatsAppSender = verifyWhatsAppSender
  },
  TwilioConfigurationError,
}))
vi.mock("../events/publish-channel-status-changed", () => ({
  publishChannelStatusChanged: publish,
}))
vi.mock("../repositories/channel-connections-repository", () => ({
  ChannelRoutingConflictError,
  OrganizationNotActiveError,
  channelConnectionsRepository: {
    isOrganizationActive,
    recordValidationFailure,
    saveManagedTwilioConnection,
    findForOrganization,
    updateChannelConnection: vi.fn(),
    disableChannelConnection: vi.fn(),
    removeChannelConnection: vi.fn(),
  },
}))
const { enqueue } = vi.hoisted(() => ({
  enqueue: vi.fn(),
}))

vi.mock("@/lib/jobs-client", () => ({ jobs: { enqueue } }))
vi.mock("@/lib/analytics", () => ({ capture: vi.fn() }))
vi.mock("../twilio-inbound-webhook-url", () => ({
  twilioInboundWebhookUrl: () =>
    "http://localhost:3001/webhooks/twilio/whatsapp/inbound",
}))

const organizationId = "01K1EDN69NFBWCG42B2H99V2C1"
const channelConnectionId = "01K1EDN69NFBWCG42B2H99V2C4"
const authToken = "super-secret-token"
const storedConnection = {
  id: channelConnectionId,
  channelType: "whatsapp" as const,
  provider: "twilio" as const,
  name: "Suporte",
  displayName: "Suporte",
  address: "+5511999999999",
  status: "active" as const,
  inboxId: "loja",
  updatedAt: new Date("2026-10-12T12:00:00.000Z"),
  session: null,
  deletable: true,
}

const createInput = {
  organizationId,
  operatorUserId: "user-id",
  displayName: "Suporte",
  address: "+5511999999999",
  accountSid: "AC11111111111111111111111111111111",
  authToken,
  inboxId: "loja",
  sandbox: false,
}

describe("channel connection use cases", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isOrganizationActive.mockResolvedValue(true)
    verifyWhatsAppSender.mockResolvedValue({
      externalSenderId: "XE11111111111111111111111111111111",
    })
    encrypt.mockReturnValue({
      ciphertext: "cipher",
      nonce: "nonce",
      authTag: "tag",
      keyVersion: "v1",
    })
    saveManagedTwilioConnection.mockImplementation(
      async (input: {
        encryptCredentials: (id: string) => { ciphertext: string }
      }) => {
        const encrypted = input.encryptCredentials(channelConnectionId)
        expect(JSON.stringify(encrypted)).not.toContain(authToken)
        return { channelConnectionId }
      }
    )
    findForOrganization.mockResolvedValue(storedConnection)
    publish.mockResolvedValue(undefined)
    enqueue.mockResolvedValue({ id: "logout-job" })
  })

  it("rejects Twilio credentials before saving a connection", async () => {
    verifyWhatsAppSender.mockRejectedValue(
      new TwilioConfigurationError("sender_not_found")
    )

    await expect(createTwilioChannelConnection(createInput)).resolves.toEqual({
      ok: false,
      error: { type: "verification_failed", reason: "sender_not_found" },
    })
    expect(saveManagedTwilioConnection).not.toHaveBeenCalled()
    expect(recordValidationFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        reason: "sender_not_found",
        operatorUserId: "user-id",
      })
    )
    expect(JSON.stringify(recordValidationFailure.mock.calls)).not.toContain(
      authToken
    )
  })

  it("saves encrypted credentials and publishes a status event", async () => {
    const result = await createTwilioChannelConnection(createInput)

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        id: channelConnectionId,
        displayName: "Suporte",
        inboxId: "loja",
        webhookUrl: "http://localhost:3001/webhooks/twilio/whatsapp/inbound",
      }),
    })
    expect(verifyWhatsAppSender.mock.invocationCallOrder[0]).toBeLessThan(
      saveManagedTwilioConnection.mock.invocationCallOrder[0]!
    )
    expect(publish).toHaveBeenCalledWith({
      organizationId,
      channelConnectionId,
    })
    expect(JSON.stringify(result)).not.toContain(authToken)
  })

  it("does not call Twilio when the Organization is unavailable", async () => {
    isOrganizationActive.mockResolvedValue(false)

    await expect(createTwilioChannelConnection(createInput)).resolves.toEqual({
      ok: false,
      error: { type: "organization_unavailable" },
    })
    expect(verifyWhatsAppSender).not.toHaveBeenCalled()
  })

  it("maps a routing conflict without publishing", async () => {
    saveManagedTwilioConnection.mockRejectedValue(
      new ChannelRoutingConflictError()
    )

    await expect(createTwilioChannelConnection(createInput)).resolves.toEqual({
      ok: false,
      error: { type: "routing_conflict" },
    })
    expect(publish).not.toHaveBeenCalled()
  })

  it("publishes after a rename", async () => {
    vi.mocked(
      channelConnectionsRepository.updateChannelConnection
    ).mockResolvedValue("updated")

    const result = await updateChannelConnection({
      organizationId,
      channelConnectionId,
      operatorUserId: "user-id",
      displayName: "Loja",
      inboxId: null,
    })

    expect(result.ok).toBe(true)
    expect(publish).toHaveBeenCalledWith({
      organizationId,
      channelConnectionId,
    })
  })

  it("does not publish when the connection is missing", async () => {
    vi.mocked(
      channelConnectionsRepository.updateChannelConnection
    ).mockResolvedValue("not_found")
    vi.mocked(
      channelConnectionsRepository.removeChannelConnection
    ).mockResolvedValue({ outcome: "not_found" })

    await expect(
      updateChannelConnection({
        organizationId,
        channelConnectionId,
        operatorUserId: "user-id",
        displayName: "Loja",
      })
    ).resolves.toEqual({ ok: false, error: { type: "not_found" } })
    await expect(
      deleteChannelConnection({
        organizationId,
        channelConnectionId,
        operatorUserId: "user-id",
      })
    ).resolves.toEqual({ ok: false, error: { type: "not_found" } })
    expect(publish).not.toHaveBeenCalled()
  })

  it("publishes when a connection with history is deactivated", async () => {
    vi.mocked(
      channelConnectionsRepository.removeChannelConnection
    ).mockResolvedValue({ outcome: "disabled", provider: "twilio" })

    await expect(
      deleteChannelConnection({
        organizationId,
        channelConnectionId,
        operatorUserId: "user-id",
      })
    ).resolves.toEqual({ ok: true, value: undefined })
    expect(publish).toHaveBeenCalledWith({
      organizationId,
      channelConnectionId,
    })
    expect(enqueue).not.toHaveBeenCalled()
  })

  it("asks the gateway to log out a removed Baileys session", async () => {
    vi.mocked(
      channelConnectionsRepository.removeChannelConnection
    ).mockResolvedValue({ outcome: "deleted", provider: "baileys" })

    await deleteChannelConnection({
      organizationId,
      channelConnectionId,
      operatorUserId: "user-id",
    })

    expect(enqueue).toHaveBeenCalledWith("wa-logout", {
      organizationId,
      channelConnectionId,
    })
  })

  it("reopens pairing when a Baileys number must be paired again", async () => {
    vi.mocked(
      channelConnectionsRepository.updateChannelConnection
    ).mockResolvedValue("pairing_started")
    findForOrganization.mockResolvedValue({
      ...storedConnection,
      provider: "baileys",
      status: "pending",
    })

    const result = await updateChannelConnection({
      organizationId,
      channelConnectionId,
      operatorUserId: "user-id",
      status: "active",
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.status).toBe("pending")
      expect(result.value.provider).toBe("baileys")
    }
    expect(enqueue).toHaveBeenCalledWith("wa-connect", {
      organizationId,
      channelConnectionId,
    })
    expect(publish).toHaveBeenCalledWith({
      organizationId,
      channelConnectionId,
    })
  })
})
