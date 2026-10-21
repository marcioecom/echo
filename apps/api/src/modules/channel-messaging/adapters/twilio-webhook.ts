import type { Result } from "@/common/result"
import type {
  InboundMessageContent,
  NormalizedInboundMessage,
  UnsupportedMediaKind,
} from "@workspace/domain"

import {
  isSupportedInboundAudioMimeType,
  normalizeAudioMimeType,
  normalizedInboundMessageSchema,
} from "@workspace/domain"
import twilio from "twilio"
import { z } from "zod"

import { err, ok } from "@/common/result"

import { twilioAccountSidSchema, whatsAppAddressSchema } from "../schemas"

export const twilioWebhookRequestSchema = z.object({
  signature: z.string().min(1),
  form: z.record(z.string(), z.string()),
})

// Twilio uses SM for SMS and MM for media messages (for example inbound
// WhatsApp voice notes), so both prefixes are valid inbound/status SIDs.
const twilioMessageSidSchema = z.string().regex(/^(SM|MM)[a-fA-F0-9]{32}$/)

const twilioWebhookRoutingSchema = z.object({
  AccountSid: twilioAccountSidSchema,
  To: whatsAppAddressSchema,
})

const twilioStatusWebhookRoutingSchema = z.object({
  AccountSid: twilioAccountSidSchema,
  From: whatsAppAddressSchema,
})

export const twilioStatusWebhookSchema = z
  .object({
    MessageSid: twilioMessageSidSchema,
    MessageStatus: z.enum([
      "queued",
      "sent",
      "delivered",
      "read",
      "failed",
      "undelivered",
    ]),
    AccountSid: twilioAccountSidSchema,
    From: whatsAppAddressSchema,
  })
  .loose()

const twilioInboundMessageSchema = z
  .object({
    MessageSid: twilioMessageSidSchema,
    AccountSid: twilioAccountSidSchema,
    From: whatsAppAddressSchema,
    To: whatsAppAddressSchema,
    Body: z.string(),
    ProfileName: z.string().optional(),
    NumMedia: z.coerce.number().int().min(0),
  })
  .loose()

export function parseTwilioWebhookRouting(
  form: Record<string, string>
): Result<{ accountSid: string; address: string }, "unknown_connection"> {
  const routing = twilioWebhookRoutingSchema.safeParse(form)
  if (!routing.success) return err("unknown_connection")

  return ok({
    accountSid: routing.data.AccountSid,
    address: routing.data.To,
  })
}

export function parseTwilioStatusWebhookRouting(
  form: Record<string, string>
): Result<{ accountSid: string; address: string }, "unknown_connection"> {
  const routing = twilioStatusWebhookRoutingSchema.safeParse(form)
  if (!routing.success) return err("unknown_connection")

  return ok({
    accountSid: routing.data.AccountSid,
    address: routing.data.From,
  })
}

export function verifyTwilioWebhook(input: {
  authToken: string
  signature: string
  url: string
  form: Record<string, string>
}): boolean {
  return twilio.validateRequest(
    input.authToken,
    input.signature,
    input.url,
    input.form
  )
}

export function normalizeTwilioInboundMessage(input: {
  organizationId: string
  channelConnectionId: string
  form: Record<string, string>
  receivedAt: Date
}): Result<NormalizedInboundMessage, "malformed_event"> {
  const result = twilioInboundMessageSchema.safeParse(input.form)
  if (!result.success) return err("malformed_event")

  const parsed = result.data
  const body = parsed.Body.trim()
  const senderDisplayName = parsed.ProfileName?.trim() || undefined

  if (!body && parsed.NumMedia === 0) return err("malformed_event")

  const content = normalizeContent(input.form, parsed.NumMedia, body)
  if (!content) return err("malformed_event")

  const normalized = normalizedInboundMessageSchema.safeParse({
    organizationId: input.organizationId,
    channelConnectionId: input.channelConnectionId,
    channelType: "whatsapp",
    senderAddress: parsed.From,
    ...(senderDisplayName ? { senderDisplayName } : {}),
    externalMessageId: parsed.MessageSid,
    content,
    receivedAt: input.receivedAt,
  })

  return normalized.success ? ok(normalized.data) : err("malformed_event")
}

function normalizeContent(
  form: Record<string, string>,
  mediaCount: number,
  body: string
): InboundMessageContent | null {
  if (mediaCount === 0) return { type: "text", body }

  const audioMimeType =
    mediaCount === 1 && body === "" && form.MediaContentType0
      ? normalizeAudioMimeType(form.MediaContentType0)
      : null

  if (
    audioMimeType?.startsWith("audio/") &&
    isSupportedInboundAudioMimeType(audioMimeType)
  ) {
    const mediaUrl = z.url().safeParse(form.MediaUrl0)
    if (!mediaUrl.success) return null

    return {
      type: "audio",
      media: { mimeType: audioMimeType, ref: { url: mediaUrl.data } },
    }
  }

  return {
    type: "unsupported",
    mediaKind: classifyMediaKind(form, mediaCount),
  }
}

function classifyMediaKind(
  form: Record<string, string>,
  mediaCount: number
): UnsupportedMediaKind {
  const kinds = new Set<UnsupportedMediaKind>()

  for (let index = 0; index < mediaCount; index += 1) {
    const contentType = form[`MediaContentType${index}`]?.toLowerCase()
    if (contentType?.startsWith("image/")) kinds.add("image")
    else if (contentType?.startsWith("audio/")) kinds.add("audio")
    else if (contentType?.startsWith("video/")) kinds.add("video")
    else if (contentType) kinds.add("document")
    else kinds.add("unknown")
  }

  return kinds.size === 1 ? [...kinds][0]! : "unknown"
}
