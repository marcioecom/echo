import { describe, expect, it } from "vitest"

import { createChannelCredentialsCipher } from "./channel-credentials-cipher"

const encryptionKey = Buffer.alloc(32, 7).toString("base64")
const context = {
  organizationId: "01K1EDN69NFBWCG42B2H99V2C1",
  channelConnectionId: "01K1EDN9C8VT0N8WRM13RM6M55",
  provider: "twilio" as const,
}

describe("channel credentials cipher", () => {
  it("round trips credentials with a fresh nonce", () => {
    const cipher = createChannelCredentialsCipher({
      encryptionKey,
      keyVersion: "v1",
    })

    const first = cipher.encrypt("secret", context)
    const second = cipher.encrypt("secret", context)

    expect(first.ciphertext).not.toBe("secret")
    expect(first.nonce).not.toBe(second.nonce)
    expect(cipher.decrypt(first, context)).toBe("secret")
  })

  it("rejects tampering and the wrong authenticated context", () => {
    const cipher = createChannelCredentialsCipher({
      encryptionKey,
      keyVersion: "v1",
    })
    const encrypted = cipher.encrypt("secret", context)

    expect(() =>
      cipher.decrypt(
        {
          ...encrypted,
          ciphertext: Buffer.from("tampered").toString("base64"),
        },
        context
      )
    ).toThrow()
    expect(() =>
      cipher.decrypt(encrypted, {
        ...context,
        organizationId: "01K1EF2SKJGM5S5BW7RNFRPRY4",
      })
    ).toThrow()
  })

  it("rejects credentials encrypted with another key version", () => {
    const cipher = createChannelCredentialsCipher({
      encryptionKey,
      keyVersion: "v2",
    })

    expect(() =>
      cipher.decrypt(
        {
          ciphertext: "",
          nonce: "",
          authTag: "",
          keyVersion: "v1",
        },
        context
      )
    ).toThrow("Unsupported channel credentials key version")
  })
})
