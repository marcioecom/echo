import { describe, expect, it, vi } from "vitest"

import { TwilioChannelProvider } from "./twilio-channel-provider"

const input = {
  accountSid: "AC11111111111111111111111111111111",
  authToken: "secret",
  address: "+5511999999999",
}

describe("Twilio channel provider", () => {
  it("accepts an online WhatsApp sender owned by the subaccount", async () => {
    const provider = new TwilioChannelProvider(input.accountSid, input.authToken)
    const listSenders = vi.spyOn(provider, "listSenders").mockResolvedValue([
      {
        sid: "XE11111111111111111111111111111111",
        senderId: "whatsapp:+5511999999999",
        status: "ONLINE",
      },
    ] as never)

    await expect(provider.verifyWhatsAppSender(input)).resolves.toEqual({
      externalSenderId: "XE11111111111111111111111111111111",
    })
    expect(listSenders).toHaveBeenCalledWith()
  })

  it("rejects missing and non-online senders", async () => {
    const missingProvider = new TwilioChannelProvider(
      input.accountSid,
      input.authToken
    )
    vi.spyOn(missingProvider, "listSenders").mockResolvedValue([])
    const offlineProvider = new TwilioChannelProvider(
      input.accountSid,
      input.authToken
    )
    vi.spyOn(offlineProvider, "listSenders").mockResolvedValue([
      {
        sid: "XE11111111111111111111111111111111",
        senderId: "whatsapp:+5511999999999",
        status: "OFFLINE",
      },
    ] as never)

    await expect(
      missingProvider.verifyWhatsAppSender(input)
    ).rejects.toMatchObject({ reason: "sender_not_found" })
    await expect(
      offlineProvider.verifyWhatsAppSender(input)
    ).rejects.toMatchObject({ reason: "sender_not_online" })
  })

  it("redacts provider failures behind a stable error", async () => {
    const cause = new Error("secret provider detail")
    const provider = new TwilioChannelProvider(input.accountSid, input.authToken)
    vi.spyOn(provider, "listSenders").mockRejectedValue(cause)

    await expect(provider.verifyWhatsAppSender(input)).rejects.toEqual(
      expect.objectContaining({
        cause,
        message: "Twilio WhatsApp configuration could not be verified",
        reason: "provider_request_failed",
      })
    )
  })

  it("verifies the shared Sandbox through the owning Twilio Account", async () => {
    const provider = new TwilioChannelProvider(input.accountSid, input.authToken)
    const listSenders = vi.spyOn(provider, "listSenders")
    const fetchAccount = vi.spyOn(provider, "fetchAccount").mockResolvedValue({
      sid: input.accountSid,
      status: "active",
    } as never)

    await expect(
      provider.verifyWhatsAppSender({
        ...input,
        address: "+14155238886",
        sandbox: true,
      })
    ).resolves.toEqual({ externalSenderId: input.accountSid })
    expect(fetchAccount).toHaveBeenCalledWith()
    expect(listSenders).not.toHaveBeenCalled()
  })

  it("rejects Sandbox mode for any other address", async () => {
    const provider = new TwilioChannelProvider(input.accountSid, input.authToken)
    const fetchAccount = vi.spyOn(provider, "fetchAccount")

    await expect(
      provider.verifyWhatsAppSender({ ...input, sandbox: true })
    ).rejects.toMatchObject({ reason: "invalid_sandbox_address" })
    expect(fetchAccount).not.toHaveBeenCalled()
  })
})
