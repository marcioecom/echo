import type {
  ChannelAdapter,
  ConnectionContext,
  ConnectionHealth,
  DeliveryStatus,
  MediaRef,
  OutboundContent,
  SendResult,
  StatusUpdate,
} from "./channel-adapter"
import type {
  ITwilioChannelProvider,
  TwilioMediaStream,
} from "./twilio-channel-provider"

import {
  isPermanentTwilioSendError,
  TwilioChannelProvider,
} from "./twilio-channel-provider"

const twilioDeliveryStatuses = {
  queued: "pending",
  sent: "sent",
  delivered: "delivered",
  read: "read",
  failed: "failed",
  undelivered: "failed",
} as const satisfies Record<string, DeliveryStatus>

export type TwilioDeliveryMessageStatus = keyof typeof twilioDeliveryStatuses

type WhatsAppTextSender = Pick<
  ITwilioChannelProvider,
  "sendWhatsAppTextMessage"
> &
  Partial<Pick<ITwilioChannelProvider, "fetchMedia">>

export type TwilioMediaRequestErrorReason =
  | "missing_url"
  | "missing_account"
  | "missing_credentials"
  | "provider_unavailable"

export class TwilioMediaRequestError extends Error {
  readonly retryable = false

  constructor(
    readonly reason: TwilioMediaRequestErrorReason,
    options?: ErrorOptions
  ) {
    super("Twilio media request is missing required context", options)
    this.name = "TwilioMediaRequestError"
  }
}

export function twilioStatusCallbackUrl(publicApiUrl: string): string {
  return new URL("/webhooks/twilio/whatsapp/status", publicApiUrl).toString()
}

export function statusUpdateFromTwilio(input: {
  organizationId: string
  channelConnectionId: string
  externalMessageId: string
  messageStatus: TwilioDeliveryMessageStatus
}): StatusUpdate {
  return {
    organizationId: input.organizationId,
    channelConnectionId: input.channelConnectionId,
    externalMessageId: input.externalMessageId,
    status: twilioDeliveryStatuses[input.messageStatus],
  }
}

export class TwilioAdapter implements ChannelAdapter {
  readonly provider = "twilio" as const
  readonly delivery = "webhook" as const

  constructor(
    private readonly statusCallbackUrl: string,
    private readonly createSender: (
      accountSid: string,
      authToken: string
    ) => WhatsAppTextSender = (accountSid, authToken) =>
      new TwilioChannelProvider(accountSid, authToken)
  ) {}

  async send(
    ctx: ConnectionContext,
    to: string,
    content: OutboundContent
  ): Promise<SendResult> {
    if (content.type !== "text") {
      return { ok: false, retryable: false, code: "unsupported_content" }
    }
    if (!ctx.externalAccountId) {
      return { ok: false, retryable: false, code: "missing_account" }
    }

    try {
      const sent = await this.createSender(
        ctx.externalAccountId,
        ctx.authToken
      ).sendWhatsAppTextMessage({
        from: ctx.fromAddress,
        to,
        body: content.body,
        statusCallbackUrl: this.statusCallbackUrl,
      })
      return { ok: true, externalMessageId: sent.externalMessageId }
    } catch (error) {
      return twilioSendError(error)
    }
  }

  async health(ctx: ConnectionContext): Promise<ConnectionHealth> {
    if (!ctx.authToken || !ctx.externalAccountId) {
      return { state: "disconnected", reason: "missing_credentials" }
    }
    return { state: "connected" }
  }

  async fetchMedia(
    ctx: ConnectionContext,
    ref: MediaRef
  ): Promise<TwilioMediaStream> {
    if (!ref.url) throw new TwilioMediaRequestError("missing_url")
    if (!ctx.externalAccountId)
      throw new TwilioMediaRequestError("missing_account")
    if (!ctx.authToken) throw new TwilioMediaRequestError("missing_credentials")

    const sender = this.createSender(ctx.externalAccountId, ctx.authToken)
    if (!sender.fetchMedia)
      throw new TwilioMediaRequestError("provider_unavailable")

    return sender.fetchMedia(ref.url)
  }
}

function twilioSendError(error: unknown): SendResult {
  const providerCode = readProviderCode(error)
  return {
    ok: false,
    retryable: !isPermanentTwilioSendError(error),
    code:
      providerCode === undefined
        ? "provider_request_failed"
        : String(providerCode),
    ...(providerCode === undefined ? {} : { providerCode }),
  }
}

function readProviderCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined
  }
  return typeof error.code === "number" ? error.code : undefined
}
