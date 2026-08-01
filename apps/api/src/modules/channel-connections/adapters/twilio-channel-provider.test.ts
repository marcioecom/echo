import { describe, expect, it, vi } from "vitest"

import { createTwilioChannelProvider } from "./twilio-channel-provider"

const input = {
  accountSid: "AC11111111111111111111111111111111",
  authToken: "secret",
  address: "+5511999999999",
}

describe("Twilio channel provider", () => {
  it("accepts an online WhatsApp sender owned by the subaccount", async () => {
    const listSenders = vi.fn().mockResolvedValue([
      {
        sid: "XE11111111111111111111111111111111",
        senderId: "whatsapp:+5511999999999",
        status: "ONLINE",
      },
    ])
    const provider = createTwilioChannelProvider({ listSenders })

    await expect(provider.verifyWhatsAppSender(input)).resolves.toEqual({
      externalSenderId: "XE11111111111111111111111111111111",
    })
    expect(listSenders).toHaveBeenCalledWith(input.accountSid, input.authToken)
  })

  it("rejects missing and non-online senders", async () => {
    const missingProvider = createTwilioChannelProvider({
      listSenders: vi.fn().mockResolvedValue([]),
    })
    const offlineProvider = createTwilioChannelProvider({
      listSenders: vi.fn().mockResolvedValue([
        {
          sid: "XE11111111111111111111111111111111",
          senderId: "whatsapp:+5511999999999",
          status: "OFFLINE",
        },
      ]),
    })

    await expect(
      missingProvider.verifyWhatsAppSender(input)
    ).rejects.toMatchObject({ reason: "sender_not_found" })
    await expect(
      offlineProvider.verifyWhatsAppSender(input)
    ).rejects.toMatchObject({ reason: "sender_not_online" })
  })

  it("redacts provider failures behind a stable error", async () => {
    const provider = createTwilioChannelProvider({
      listSenders: vi
        .fn()
        .mockRejectedValue(new Error("secret provider detail")),
    })

    await expect(provider.verifyWhatsAppSender(input)).rejects.toEqual(
      expect.objectContaining({
        message: "Twilio WhatsApp configuration could not be verified",
        reason: "provider_request_failed",
      })
    )
  })

  it("verifies the shared Sandbox through the owning Twilio Account", async () => {
    const listSenders = vi.fn().mockResolvedValue([])
    const fetchAccount = vi.fn().mockResolvedValue({
      sid: input.accountSid,
      status: "active",
    })
    const provider = createTwilioChannelProvider({
      listSenders,
      fetchAccount,
    })

    await expect(
      provider.verifyWhatsAppSender({
        ...input,
        address: "+14155238886",
        sandbox: true,
      })
    ).resolves.toEqual({ externalSenderId: input.accountSid })
    expect(fetchAccount).toHaveBeenCalledWith(input.accountSid, input.authToken)
    expect(listSenders).not.toHaveBeenCalled()
  })

  it("rejects Sandbox mode for any other address", async () => {
    const fetchAccount = vi.fn()
    const provider = createTwilioChannelProvider({ fetchAccount })

    await expect(
      provider.verifyWhatsAppSender({ ...input, sandbox: true })
    ).rejects.toMatchObject({ reason: "invalid_sandbox_address" })
    expect(fetchAccount).not.toHaveBeenCalled()
  })
})
