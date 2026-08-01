import { describe, expect, it } from "vitest"

import {
  normalizeTwilioInboundMessage,
  parseTwilioWebhookRouting,
} from "./twilio-webhook"

const organizationId = "01K1EDN69NFBWCG42B2H99V2C1"
const channelConnectionId = "01K1EDN9C8VT0N8WRM13RM6M55"
const receivedAt = new Date("2026-07-30T12:00:00.000Z")
const form = {
  MessageSid: "SM11111111111111111111111111111111",
  AccountSid: "AC11111111111111111111111111111111",
  From: "whatsapp:+5511888888888",
  To: "whatsapp:+5511999999999",
  Body: "Help",
  NumMedia: "0",
}

describe("Twilio inbound webhook adapter", () => {
  it("returns an unknown connection result instead of throwing for invalid routing", () => {
    expect(
      parseTwilioWebhookRouting({ ...form, To: "whatsapp:invalid" })
    ).toEqual({ ok: false, error: "unknown_connection" })
    expect(
      parseTwilioWebhookRouting({ ...form, AccountSid: "invalid" })
    ).toEqual({ ok: false, error: "unknown_connection" })
  })

  it("normalizes a text Message and accepts additional provider fields", () => {
    expect(
      normalizeTwilioInboundMessage({
        organizationId,
        channelConnectionId,
        form: { ...form, FutureField: "preserved at the provider edge" },
        receivedAt,
      })
    ).toEqual({
      ok: true,
      value: {
        organizationId,
        channelConnectionId,
        channelType: "whatsapp",
        senderAddress: "+5511888888888",
        externalMessageId: form.MessageSid,
        content: { type: "text", body: "Help" },
        receivedAt,
      },
    })
  })

  it("marks media as unsupported even when Twilio includes a text caption", () => {
    expect(
      normalizeTwilioInboundMessage({
        organizationId,
        channelConnectionId,
        form: {
          ...form,
          Body: "Image caption",
          NumMedia: "1",
          MediaContentType0: "image/jpeg",
        },
        receivedAt,
      })
    ).toMatchObject({
      ok: true,
      value: { content: { type: "unsupported", mediaKind: "image" } },
    })
  })

  it("rejects malformed or empty inbound events without throwing", () => {
    for (const malformedForm of [
      { ...form, MessageSid: "invalid" },
      { ...form, From: "whatsapp:invalid" },
      { ...form, Body: " ", NumMedia: "0" },
      { ...form, NumMedia: "-1" },
    ]) {
      expect(
        normalizeTwilioInboundMessage({
          organizationId,
          channelConnectionId,
          form: malformedForm,
          receivedAt,
        })
      ).toEqual({ ok: false, error: "malformed_event" })
    }
  })
})
