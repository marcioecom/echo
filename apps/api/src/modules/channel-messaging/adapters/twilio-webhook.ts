import { normalizedInboundMessageSchema } from "@workspace/domain"
import type {
  NormalizedInboundMessage,
  UnsupportedMediaKind,
} from "@workspace/domain"
import twilio from "twilio"
import { z } from "zod"

import { err, ok, type Result } from "@/common/result"
import { twilioAccountSidSchema, whatsAppAddressSchema } from "../schemas"

export const twilioWebhookRequestSchema = z.object({
  signature: z.string().min(1),
  form: z.record(z.string(), z.string()),
})

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
    MessageSid: z.string().regex(/^SM[a-fA-F0-9]{32}$/),
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
    MessageSid: z.string().regex(/^SM[a-fA-F0-9]{32}$/),
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

  const normalized = normalizedInboundMessageSchema.safeParse({
    organizationId: input.organizationId,
    channelConnectionId: input.channelConnectionId,
    channelType: "whatsapp",
    senderAddress: parsed.From,
    ...(senderDisplayName ? { senderDisplayName } : {}),
    externalMessageId: parsed.MessageSid,
    content:
      parsed.NumMedia > 0
        ? {
            type: "unsupported",
            mediaKind: classifyMediaKind(input.form, parsed.NumMedia),
          }
        : { type: "text", body },
    receivedAt: input.receivedAt,
  })

  return normalized.success ? ok(normalized.data) : err("malformed_event")
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
