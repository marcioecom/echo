import { describe, expect, it } from "vitest"

import { normalizeTwilioInboundMessage } from "./normalize-twilio-inbound-message"

const receivedAt = new Date("2026-07-30T12:00:00.000Z")
const baseWebhook = {
  organizationId: "01K1EDN69NFBWCG42B2H99V2C1",
  channelConnectionId: "01K1EDN9C8VT0N8WRM13RM6M55",
  channelType: "whatsapp" as const,
  address: "+5511000000000",
  form: {
    MessageSid: "SM11111111111111111111111111111111",
    AccountSid: "AC11111111111111111111111111111111",
    From: "whatsapp:+5511999999999",
    To: "whatsapp:+5511000000000",
    Body: "  Preciso de ajuda  ",
    ProfileName: "  Maria  ",
    NumMedia: "0",
  },
}

describe("normalizeTwilioInboundMessage", () => {
  it("normalizes a text message without leaking provider routing data", () => {
    expect(normalizeTwilioInboundMessage(baseWebhook, receivedAt)).toEqual({
      organizationId: baseWebhook.organizationId,
      channelConnectionId: baseWebhook.channelConnectionId,
      channelType: "whatsapp",
      senderAddress: "+5511999999999",
      senderDisplayName: "Maria",
      externalMessageId: baseWebhook.form.MessageSid,
      content: { type: "text", body: "Preciso de ajuda" },
      receivedAt,
    })
  })

  it("maps media without text to unsupported content", () => {
    const webhook = {
      ...baseWebhook,
      form: {
        ...baseWebhook.form,
        Body: " ",
        NumMedia: "1",
        MediaContentType0: "image/jpeg",
      },
    }

    expect(normalizeTwilioInboundMessage(webhook, receivedAt).content).toEqual({
      type: "unsupported",
      mediaKind: "image",
    })
  })

  it("rejects an authenticated event without text or media", () => {
    expect(() =>
      normalizeTwilioInboundMessage(
        { ...baseWebhook, form: { ...baseWebhook.form, Body: " " } },
        receivedAt
      )
    ).toThrow("no supported content")
  })

  it("rejects malformed sender addresses and message identifiers", () => {
    expect(() =>
      normalizeTwilioInboundMessage(
        {
          ...baseWebhook,
          form: { ...baseWebhook.form, From: "not-a-whatsapp-address" },
        },
        receivedAt
      )
    ).toThrow()
    expect(() =>
      normalizeTwilioInboundMessage(
        {
          ...baseWebhook,
          form: { ...baseWebhook.form, MessageSid: "invalid" },
        },
        receivedAt
      )
    ).toThrow()
  })
})
