import type { EchoAuthState } from "../auth-state"

import { beforeEach, describe, expect, it, vi } from "vitest"

import { MediaUnavailableError, openBaileysSocket } from "./baileys-socket"

const provider = vi.hoisted(() => ({
  makeWASocket: vi.fn(),
  downloadMediaMessage: vi.fn(),
}))

vi.mock("@whiskeysockets/baileys", () => ({
  default: provider.makeWASocket,
  Browsers: { macOS: () => ["macOS", "Echo", "10.15.7"] },
  downloadMediaMessage: provider.downloadMediaMessage,
  fetchLatestBaileysVersion: vi.fn(async () => null),
  makeCacheableSignalKeyStore: vi.fn((keys: unknown) => keys),
}))

const auth = {
  state: { creds: {}, keys: {} },
} as EchoAuthState

function fakeSock() {
  return {
    user: { id: "5511999999999@s.whatsapp.net" },
    updateMediaMessage: vi.fn(async () => undefined),
  }
}

describe("openBaileysSocket", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    provider.makeWASocket.mockReturnValue(fakeSock())
  })

  it("keeps history sync disabled", async () => {
    await openBaileysSocket({
      auth,
      getMessage: async () => undefined,
    })

    expect(provider.makeWASocket).toHaveBeenCalledWith(
      expect.objectContaining({
        syncFullHistory: false,
        shouldSyncHistoryMessage: expect.any(Function),
      })
    )
    const [options] = provider.makeWASocket.mock.calls[0] ?? []
    expect(options.shouldSyncHistoryMessage()).toBe(false)
  })

  it("downloads the stored message for the sender jid", async () => {
    const message = { audioMessage: { mimetype: "audio/ogg" } }
    provider.downloadMediaMessage.mockResolvedValue(Buffer.from([1, 2, 3]))
    const socket = await openBaileysSocket({
      auth,
      getMessage: async () => message,
    })

    await expect(
      socket.downloadMedia({
        externalMessageId: "wamid.audio",
        senderAddress: "+5511888888888",
      })
    ).resolves.toEqual({
      bytes: new Uint8Array([1, 2, 3]),
      mimeType: "audio/ogg",
    })

    expect(provider.downloadMediaMessage).toHaveBeenCalledWith(
      {
        key: {
          id: "wamid.audio",
          remoteJid: "5511888888888@s.whatsapp.net",
        },
        message,
      },
      "buffer",
      {},
      expect.objectContaining({
        reuploadRequest: expect.any(Function),
        logger: expect.anything(),
      })
    )
  })

  it("rejects media when the message is no longer stored", async () => {
    const socket = await openBaileysSocket({
      auth,
      getMessage: async () => undefined,
    })

    await expect(
      socket.downloadMedia({
        externalMessageId: "wamid.audio",
        senderAddress: "+5511888888888",
      })
    ).rejects.toBeInstanceOf(MediaUnavailableError)
  })
})
