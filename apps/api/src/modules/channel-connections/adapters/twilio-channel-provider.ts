import twilio from "twilio"

export interface VerifiedTwilioSender {
  externalSenderId: string
}

export interface TwilioChannelProvider {
  verifyWhatsAppSender: (input: {
    accountSid: string
    authToken: string
    address: string
  }) => Promise<VerifiedTwilioSender>
}

interface SenderRecord {
  sid: string
  senderId: string
  status: string
}

export class TwilioConfigurationError extends Error {
  constructor(
    readonly reason:
      | "provider_request_failed"
      | "sender_not_found"
      | "sender_not_online",
    options?: ErrorOptions
  ) {
    super("Twilio WhatsApp configuration could not be verified", options)
    this.name = "TwilioConfigurationError"
  }
}

export function createTwilioChannelProvider(options?: {
  listSenders?: (
    accountSid: string,
    authToken: string
  ) => Promise<SenderRecord[]>
}): TwilioChannelProvider {
  const listSenders =
    options?.listSenders ??
    (async (accountSid: string, authToken: string) => {
      const client = twilio(accountSid, authToken)
      return client.messaging.v2.channelsSenders.list({ channel: "whatsapp" })
    })

  return {
    async verifyWhatsAppSender(input) {
      let senders: SenderRecord[]
      try {
        senders = await listSenders(input.accountSid, input.authToken)
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
    },
  }
}
