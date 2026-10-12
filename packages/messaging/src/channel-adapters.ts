import type { ChannelProvider } from "@workspace/domain"

import { BaileysAdapter, type BaileysSendTransport } from "./baileys-adapter"
import type { ChannelAdapter } from "./channel-adapter"
import { TwilioAdapter, twilioStatusCallbackUrl } from "./twilio-adapter"

export interface ChannelAdapterRegistry {
  adapterFor(provider: ChannelProvider): ChannelAdapter | undefined
}

export function createChannelAdapterRegistry(
  publicApiUrl: string,
  baileysTransport: BaileysSendTransport
): ChannelAdapterRegistry {
  const twilio = new TwilioAdapter(twilioStatusCallbackUrl(publicApiUrl))
  const baileys = new BaileysAdapter(baileysTransport)

  return {
    adapterFor(provider) {
      if (provider === "twilio") return twilio
      if (provider === "baileys") return baileys
      return undefined
    },
  }
}
