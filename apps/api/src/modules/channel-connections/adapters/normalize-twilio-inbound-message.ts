import type { UnsupportedMediaKind } from "@workspace/domain"
import { z } from "zod"

import type { InboundChannelMessage } from "../../messages/types"
import type { AuthenticatedTwilioWebhook } from "../http/register-twilio-whatsapp-webhook"
import { normalizeWhatsAppAddress, twilioAccountSidSchema } from "../schemas"

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

export class TwilioInboundMessageNormalizationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = "TwilioInboundMessageNormalizationError"
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

export function normalizeTwilioInboundMessage(
  webhook: AuthenticatedTwilioWebhook,
  receivedAt: Date
): InboundChannelMessage {
  const result = twilioInboundMessageSchema.safeParse(webhook.form)
  if (!result.success) {
    throw new TwilioInboundMessageNormalizationError(
      "Authenticated Twilio event is malformed",
      { cause: result.error }
    )
  }

  const parsed = result.data
  let senderAddress: string
  try {
    senderAddress = normalizeWhatsAppAddress(parsed.From)
  } catch (error) {
    throw new TwilioInboundMessageNormalizationError(
      "Authenticated Twilio sender address is malformed",
      { cause: error }
    )
  }
  const body = parsed.Body.trim()
  const senderDisplayName = parsed.ProfileName?.trim() || undefined

  if (!body && parsed.NumMedia === 0) {
    throw new TwilioInboundMessageNormalizationError(
      "Authenticated Twilio event has no supported content"
    )
  }

  return {
    organizationId: webhook.organizationId,
    channelConnectionId: webhook.channelConnectionId,
    channelType: webhook.channelType,
    senderAddress,
    ...(senderDisplayName ? { senderDisplayName } : {}),
    externalMessageId: parsed.MessageSid,
    content: body
      ? { type: "text", body }
      : {
        type: "unsupported",
        mediaKind: classifyMediaKind(webhook.form, parsed.NumMedia),
      },
    receivedAt,
  }
}
