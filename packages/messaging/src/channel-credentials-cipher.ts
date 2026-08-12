import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

const ALGORITHM = "aes-256-gcm"
const NONCE_LENGTH = 12

export interface ChannelCredentialContext {
  organizationId: string
  channelConnectionId: string
  provider: "twilio"
}

export interface EncryptedChannelCredentials {
  ciphertext: string
  nonce: string
  authTag: string
  keyVersion: string
}

export interface IChannelCredentialsCipher {
  encrypt: (
    plaintext: string,
    context: ChannelCredentialContext
  ) => EncryptedChannelCredentials
  decrypt: (
    encrypted: EncryptedChannelCredentials,
    context: ChannelCredentialContext
  ) => string
}

export interface ChannelCredentialsCipherConfig {
  encryptionKey: string
  keyVersion: string
}

function serializeContext(context: ChannelCredentialContext): Buffer {
  return Buffer.from(
    JSON.stringify([
      context.organizationId,
      context.channelConnectionId,
      context.provider,
    ])
  )
}

export class ChannelCredentialsCipher implements IChannelCredentialsCipher {
  private readonly key: Buffer<ArrayBuffer>
  private readonly keyVersion: string

  constructor(config: ChannelCredentialsCipherConfig) {
    const key = Buffer.from(config.encryptionKey, "base64")
    if (key.length !== 32) {
      throw new Error("Channel credentials encryption key must be 32 bytes")
    }
    this.key = key
    this.keyVersion = config.keyVersion
  }

  encrypt(plaintext: string, context: ChannelCredentialContext) {
    const nonce = randomBytes(NONCE_LENGTH)
    const cipher = createCipheriv(ALGORITHM, this.key, nonce)
    cipher.setAAD(serializeContext(context))
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ])

    return {
      ciphertext: ciphertext.toString("base64"),
      nonce: nonce.toString("base64"),
      authTag: cipher.getAuthTag().toString("base64"),
      keyVersion: this.keyVersion,
    }
  }

  decrypt(
    encrypted: EncryptedChannelCredentials,
    context: ChannelCredentialContext
  ) {
    if (encrypted.keyVersion !== this.keyVersion) {
      throw new Error("Unsupported channel credentials key version")
    }

    const decipher = createDecipheriv(
      ALGORITHM,
      this.key,
      Buffer.from(encrypted.nonce, "base64")
    )
    decipher.setAAD(serializeContext(context))
    decipher.setAuthTag(Buffer.from(encrypted.authTag, "base64"))

    return Buffer.concat([
      decipher.update(Buffer.from(encrypted.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8")
  }
}
