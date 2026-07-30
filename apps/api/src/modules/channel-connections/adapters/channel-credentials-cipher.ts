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

export interface ChannelCredentialsCipher {
  encrypt: (
    plaintext: string,
    context: ChannelCredentialContext
  ) => EncryptedChannelCredentials
  decrypt: (
    encrypted: EncryptedChannelCredentials,
    context: ChannelCredentialContext
  ) => string
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

export function createChannelCredentialsCipher(options: {
  encryptionKey: string
  keyVersion: string
}): ChannelCredentialsCipher {
  const key = Buffer.from(options.encryptionKey, "base64")
  if (key.length !== 32) {
    throw new Error("Channel credentials encryption key must be 32 bytes")
  }

  return {
    encrypt(plaintext, context) {
      const nonce = randomBytes(NONCE_LENGTH)
      const cipher = createCipheriv(ALGORITHM, key, nonce)
      cipher.setAAD(serializeContext(context))
      const ciphertext = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final(),
      ])

      return {
        ciphertext: ciphertext.toString("base64"),
        nonce: nonce.toString("base64"),
        authTag: cipher.getAuthTag().toString("base64"),
        keyVersion: options.keyVersion,
      }
    },
    decrypt(encrypted, context) {
      if (encrypted.keyVersion !== options.keyVersion) {
        throw new Error("Unsupported channel credentials key version")
      }

      const decipher = createDecipheriv(
        ALGORITHM,
        key,
        Buffer.from(encrypted.nonce, "base64")
      )
      decipher.setAAD(serializeContext(context))
      decipher.setAuthTag(Buffer.from(encrypted.authTag, "base64"))

      return Buffer.concat([
        decipher.update(Buffer.from(encrypted.ciphertext, "base64")),
        decipher.final(),
      ]).toString("utf8")
    },
  }
}
