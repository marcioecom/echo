import { describe, expect, it, vi } from "vitest"

const provider = vi.hoisted(() => ({ makeWASocket: vi.fn() }))

vi.mock("@whiskeysockets/baileys", () => ({
  default: provider.makeWASocket,
  Browsers: { macOS: () => ["macOS", "Echo", "10.15.7"] },
  fetchLatestBaileysVersion: vi.fn(async () => null),
  makeCacheableSignalKeyStore: vi.fn((keys: unknown) => keys),
}))

import type { EchoAuthState } from "../auth-state"
import { openBaileysSocket } from "./baileys-socket"

describe("openBaileysSocket", () => {
  it("keeps history sync disabled", async () => {
    const auth = {
      state: { creds: {}, keys: {} },
    } as EchoAuthState

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
})
