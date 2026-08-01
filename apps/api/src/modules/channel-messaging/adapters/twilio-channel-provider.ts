import twilio, { Twilio } from "twilio"

export interface VerifiedTwilioSender {
  externalSenderId: string
}

export interface ITwilioChannelProvider {
  verifyWhatsAppSender: (input: {
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

export class TwilioChannelProvider implements ITwilioChannelProvider {
  private readonly twilioClient: Twilio

  constructor(accountSid: string, authToken: string) {
    this.twilioClient = twilio(accountSid, authToken)
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
}
