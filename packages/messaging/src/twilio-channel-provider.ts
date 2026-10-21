import twilio, { Twilio } from "twilio"

export interface VerifiedTwilioSender {
  externalSenderId: string
}

export interface SendWhatsAppTextMessageInput {
  from: string
  to: string
  body: string
  statusCallbackUrl?: string
}

export interface SentWhatsAppMessage {
  externalMessageId: string
}

export interface TwilioMediaStream {
  stream: ReadableStream
  mime: string
}

export interface ITwilioChannelProvider {
  verifyWhatsAppSender: (input: {
    address: string
    sandbox?: boolean
  }) => Promise<VerifiedTwilioSender>
  sendWhatsAppTextMessage: (
    input: SendWhatsAppTextMessageInput
  ) => Promise<SentWhatsAppMessage>
  fetchMedia: (url: string) => Promise<TwilioMediaStream>
}

export type TwilioMediaErrorReason =
  | "media_request_failed"
  | "media_unauthorized"
  | "media_expired"
  | "media_unsupported"
  | "media_too_large"

export class TwilioMediaError extends Error {
  constructor(
    readonly reason: TwilioMediaErrorReason,
    readonly retryable: boolean,
    readonly status?: number,
    options?: ErrorOptions
  ) {
    super("Twilio media could not be fetched", options)
    this.name = "TwilioMediaError"
  }
}

interface SenderRecord {
  sid: string
  senderId: string
  status: string
}

interface AccountRecord {
  sid: string
  status: string
}

export const TWILIO_WHATSAPP_SANDBOX_ADDRESS = "+14155238886"

export const TWILIO_PERMANENT_SEND_ERROR_CODES = new Set([
  21211, 21610, 21612, 63003, 63007, 63016,
])

export function isPermanentTwilioSendError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false
  const code = (error as { code?: unknown }).code
  return typeof code === "number" && TWILIO_PERMANENT_SEND_ERROR_CODES.has(code)
}

export class TwilioConfigurationError extends Error {
  constructor(
    readonly reason:
      | "provider_request_failed"
      | "sender_not_found"
      | "sender_not_online"
      | "invalid_sandbox_address"
      | "account_not_active",
    options?: ErrorOptions
  ) {
    super("Twilio WhatsApp configuration could not be verified", options)
    this.name = "TwilioConfigurationError"
  }
}

export class TwilioChannelProvider implements ITwilioChannelProvider {
  private readonly twilioClient: Twilio
  private readonly accountSid: string
  private readonly authToken: string
  private readonly fetchImpl: typeof fetch

  constructor(
    accountSid: string,
    authToken: string,
    fetchImpl: typeof fetch = fetch
  ) {
    this.twilioClient = twilio(accountSid, authToken)
    this.accountSid = accountSid
    this.authToken = authToken
    this.fetchImpl = fetchImpl
  }

  async listSenders() {
    return this.twilioClient.messaging.v2.channelsSenders.list({
      channel: "whatsapp",
    })
  }

  async fetchAccount() {
    return this.twilioClient.api.v2010
      .accounts(this.twilioClient.accountSid)
      .fetch()
  }

  async verifyWhatsAppSender(input: { address: string; sandbox?: boolean }) {
    if (input.sandbox) {
      if (input.address !== TWILIO_WHATSAPP_SANDBOX_ADDRESS) {
        throw new TwilioConfigurationError("invalid_sandbox_address")
      }

      let account: AccountRecord
      try {
        account = await this.fetchAccount()
      } catch (error) {
        throw new TwilioConfigurationError("provider_request_failed", {
          cause: error,
        })
      }
      if (account.status !== "active") {
        throw new TwilioConfigurationError("account_not_active")
      }

      return { externalSenderId: account.sid }
    }

    let senders: SenderRecord[]
    try {
      senders = await this.listSenders()
    } catch (error) {
      throw new TwilioConfigurationError("provider_request_failed", {
        cause: error,
      })
    }

    const sender = senders.find(
      (candidate) => candidate.senderId === `whatsapp:${input.address}`
    )
    if (!sender) {
      throw new TwilioConfigurationError("sender_not_found")
    }
    if (sender.status !== "ONLINE") {
      throw new TwilioConfigurationError("sender_not_online")
    }

    return { externalSenderId: sender.sid }
  }

  async sendWhatsAppTextMessage(
    input: SendWhatsAppTextMessageInput
  ): Promise<SentWhatsAppMessage> {
    const message = await this.twilioClient.messages.create({
      from: `whatsapp:${input.from}`,
      to: `whatsapp:${input.to}`,
      body: input.body,
      ...(input.statusCallbackUrl
        ? { statusCallback: input.statusCallbackUrl }
        : {}),
    })

    return { externalMessageId: message.sid }
  }

  async fetchMedia(url: string): Promise<TwilioMediaStream> {
    const authorization = Buffer.from(
      `${this.accountSid}:${this.authToken}`
    ).toString("base64")

    let response: Response
    try {
      response = await this.fetchImpl(url, {
        headers: { Authorization: `Basic ${authorization}` },
      })
    } catch (error) {
      throw new TwilioMediaError("media_request_failed", true, undefined, {
        cause: error,
      })
    }

    if (!response.ok) {
      throw twilioMediaResponseError(response.status)
    }
    if (!response.body) {
      throw new TwilioMediaError("media_request_failed", true)
    }

    const mime =
      response.headers.get("content-type")?.split(";")[0]?.trim() ||
      "application/octet-stream"

    return { stream: response.body, mime }
  }
}

function twilioMediaResponseError(status: number): TwilioMediaError {
  if (status === 401 || status === 403) {
    return new TwilioMediaError("media_unauthorized", false, status)
  }
  if (status === 404 || status === 410) {
    return new TwilioMediaError("media_expired", false, status)
  }
  if (status === 413) {
    return new TwilioMediaError("media_too_large", false, status)
  }
  if (status === 415) {
    return new TwilioMediaError("media_unsupported", false, status)
  }
  if (status === 429 || status >= 500) {
    return new TwilioMediaError("media_request_failed", true, status)
  }
  return new TwilioMediaError("media_request_failed", false, status)
}
