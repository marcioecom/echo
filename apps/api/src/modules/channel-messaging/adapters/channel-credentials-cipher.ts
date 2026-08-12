export * from "@workspace/messaging"

import { env } from "@/config/env"

import { ChannelCredentialsCipher } from "@workspace/messaging"

export const credentialsCipher = new ChannelCredentialsCipher({
  encryptionKey: env.CHANNEL_CREDENTIALS_ENCRYPTION_KEY,
  keyVersion: env.CHANNEL_CREDENTIALS_KEY_VERSION,
})
