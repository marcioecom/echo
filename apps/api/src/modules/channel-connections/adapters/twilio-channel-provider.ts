import twilio from "twilio"

export interface VerifiedTwilioSender {
  externalSenderId: string
}

export interface TwilioChannelProvider {
  verifyWhatsAppSender: (input: {
    accountSid: string
    authToken: string
    address: string
    sandbox?: boolean
  }) => Promise<VerifiedTwilioSender>
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

export function createTwilioChannelProvider(options?: {
  listSenders?: (
    accountSid: string,
    authToken: string
  ) => Promise<SenderRecord[]>
  fetchAccount?: (
    accountSid: string,
    authToken: string
  ) => Promise<AccountRecord>
}): TwilioChannelProvider {
  const listSenders =
    options?.listSenders ??
    (async (accountSid: string, authToken: string) => {
      const client = twilio(accountSid, authToken)
      return client.messaging.v2.channelsSenders.list({ channel: "whatsapp" })
    })
  const fetchAccount =
    options?.fetchAccount ??
    (async (accountSid: string, authToken: string) => {
      const client = twilio(accountSid, authToken)
      return client.api.v2010.accounts(accountSid).fetch()
    })

  return {
    async verifyWhatsAppSender(input) {
      if (input.sandbox) {
        if (input.address !== TWILIO_WHATSAPP_SANDBOX_ADDRESS) {
          throw new TwilioConfigurationError("invalid_sandbox_address")
        }

        let account: AccountRecord
        try {
          account = await fetchAccount(input.accountSid, input.authToken)
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
