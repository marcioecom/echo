import type { ChannelProvider } from "@workspace/domain"

import type { ChannelAdapter } from "./channel-adapter"
import { TwilioAdapter, twilioStatusCallbackUrl } from "./twilio-adapter"

export interface ChannelAdapterRegistry {
  adapterFor(provider: ChannelProvider): ChannelAdapter | undefined
}

export function createChannelAdapterRegistry(
  publicApiUrl: string
): ChannelAdapterRegistry {
  const twilio = new TwilioAdapter(twilioStatusCallbackUrl(publicApiUrl))

  return {
    adapterFor(provider) {
      if (provider === "twilio") return twilio
      return undefined
    },
  }
}
