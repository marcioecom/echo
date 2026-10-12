import { ChannelCredentialsCipher } from "@workspace/messaging"
import { describe, expect, it } from "vitest"

import { rotateBaileysAuthKeys, useEchoAuthState } from "./auth-state"
import { MemoryAuthKeyRepository } from "./repositories/auth-keys-repository"

const encryptionKey = Buffer.alloc(32, 7).toString("base64")
const scope = {
  organizationId: "01K1EDN69NFBWCG42B2H99V2C1",
  channelConnectionId: "01K1EDN9C8VT0N8WRM13RM6M55",
}

describe("useEchoAuthState", () => {
  it("reloads creds and keys after a restart without a new identity", async () => {
    const repository = new MemoryAuthKeyRepository()
    const cipher = new ChannelCredentialsCipher({
      encryptionKey,
      keyVersion: "v1",
    })
    const first = await useEchoAuthState({
      ...scope,
      cipher,
      repository,
      flushDelayMs: 0,
      batchSize: 1,
    })
    first.state.creds.registered = true
    first.state.creds.me = { id: "5511999999999:12@s.whatsapp.net" }
    await first.saveCreds()
    await first.state.keys.set({
      "pre-key": {
        "1": {
          public: Buffer.from("public-key"),
          private: Buffer.from("private-key"),
        },
      },
    })

    const stored = await repository.read({
      ...scope,
      keyType: "creds",
      keyId: "creds",
    })
    expect(stored?.ciphertext).not.toContain("5511999999999")
    expect(stored?.ciphertext).not.toContain("private-key")

    const second = await useEchoAuthState({
      ...scope,
      cipher,
      repository,
      flushDelayMs: 0,
      batchSize: 1,
    })
    expect(second.state.creds.registered).toBe(true)
    expect(second.state.creds.me?.id).toBe("5511999999999:12@s.whatsapp.net")
    const keys = await second.state.keys.get("pre-key", ["1"])
    expect(Buffer.from(keys["1"]!.public).toString()).toBe("public-key")
  })

  it("hard-deletes every key for the connection", async () => {
    const repository = new MemoryAuthKeyRepository()
    const cipher = new ChannelCredentialsCipher({
      encryptionKey,
      keyVersion: "v1",
    })
    const auth = await useEchoAuthState({
      ...scope,
      cipher,
      repository,
      flushDelayMs: 0,
      batchSize: 1,
    })
    await auth.saveCreds()
    await auth.clear()

    await expect(repository.list(scope)).resolves.toEqual([])
  })

  it("rotates keyVersion and refuses the previous cipher", async () => {
    const repository = new MemoryAuthKeyRepository()
    const current = new ChannelCredentialsCipher({
      encryptionKey,
      keyVersion: "v1",
    })
    const next = new ChannelCredentialsCipher({
      encryptionKey,
      keyVersion: "v2",
    })
    const auth = await useEchoAuthState({
      ...scope,
      cipher: current,
      repository,
      flushDelayMs: 0,
      batchSize: 1,
    })
    auth.state.creds.registered = true
    await auth.saveCreds()

    await expect(
      useEchoAuthState({
        ...scope,
        cipher: next,
        repository,
        flushDelayMs: 0,
        batchSize: 1,
      })
    ).rejects.toThrow("Unsupported channel credentials key version")

    await expect(
      rotateBaileysAuthKeys({
        ...scope,
        repository,
        from: current,
        to: next,
      })
    ).resolves.toBe(1)

    const rotated = await useEchoAuthState({
      ...scope,
      cipher: next,
      repository,
      flushDelayMs: 0,
      batchSize: 1,
    })
    expect(rotated.state.creds.registered).toBe(true)
    const stored = await repository.read({
      ...scope,
      keyType: "creds",
      keyId: "creds",
    })
    expect(stored?.keyVersion).toBe("v2")
  })
})
