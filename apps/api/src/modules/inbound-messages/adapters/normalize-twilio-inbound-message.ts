import type { UnsupportedMediaKind } from "@workspace/domain"
import { z } from "zod"

import { err, ok, type Result } from "../../../common/result"
import { normalizeWhatsAppAddress, twilioAccountSidSchema } from "../schemas"
import type {
  AuthenticatedTwilioWebhook,
  InboundChannelMessage,
} from "../types"

const twilioInboundMessageSchema = z
  .object({
    MessageSid: z.string().regex(/^SM[a-fA-F0-9]{32}$/),
    AccountSid: twilioAccountSidSchema,
    From: z.string(),
    To: z.string(),
    Body: z.string(),
    ProfileName: z.string().optional(),
    NumMedia: z.coerce.number().int().min(0),
  })
  .loose()

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

export function normalizeTwilioInboundMessage(
  webhook: AuthenticatedTwilioWebhook,
  receivedAt: Date
): Result<InboundChannelMessage, "malformed_event"> {
  const result = twilioInboundMessageSchema.safeParse(webhook.form)
  if (!result.success) {
    return err("malformed_event")
  }

  const parsed = result.data
  const senderAddress = normalizeWhatsAppAddressSchema.safeParse(parsed.From)
  if (!senderAddress.success) return err("malformed_event")
  const body = parsed.Body.trim()
  const senderDisplayName = parsed.ProfileName?.trim() || undefined

  if (!body && parsed.NumMedia === 0) {
    return err("malformed_event")
  }

  return ok({
    organizationId: webhook.organizationId,
    channelConnectionId: webhook.channelConnectionId,
    channelType: webhook.channelType,
    senderAddress: senderAddress.data,
    ...(senderDisplayName ? { senderDisplayName } : {}),
    externalMessageId: parsed.MessageSid,
    content: body
      ? { type: "text", body }
      : {
          type: "unsupported",
          mediaKind: classifyMediaKind(webhook.form, parsed.NumMedia),
        },
    receivedAt,
  })
}

const normalizeWhatsAppAddressSchema = z
  .string()
  .transform(normalizeWhatsAppAddress)
