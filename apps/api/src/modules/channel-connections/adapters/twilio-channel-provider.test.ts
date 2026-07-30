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
})
