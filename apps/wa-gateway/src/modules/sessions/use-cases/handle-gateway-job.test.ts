import { UnrecoverableError } from "bullmq"
import { describe, expect, it, vi } from "vitest"

import { SessionRegistry } from "../registry"
import type { BaileysSession } from "../session"
import { handleWaGatewayJob } from "./handle-gateway-job"

const organizationId = "01K1EDN69NFBWCG42B2H99V2C1"
const channelConnectionId = "01K1EDN9C8VT0N8WRM13RM6M55"
const otherConnectionId = "01K1EDN69NFBWCG42B2H99V2C6"

function fakeSession() {
  return {
    run: vi.fn(() => new Promise(() => undefined)),
    stop: vi.fn(async () => undefined),
    logout: vi.fn(async () => undefined),
    requestPairingCode: vi.fn(async () => undefined),
    sendText: vi.fn(async () => ({
      ok: true as const,
      externalMessageId: "wamid.out",
    })),
  }
}

describe("SessionRegistry", () => {
  it("resumes one saved session and refuses a second connection", async () => {
    const sessions = [fakeSession(), fakeSession()]
    const registry = new SessionRegistry({
      findResumable: async () => ({ organizationId, channelConnectionId }),
      createSession: () => sessions.shift() as unknown as BaileysSession,
    })
    await registry.start()
    expect(sessions).toHaveLength(1)

    await expect(
      handleWaGatewayJob(registry, {
        name: "wa-connect",
        data: { organizationId, channelConnectionId: otherConnectionId },
      })
    ).rejects.toBeInstanceOf(UnrecoverableError)
  })

  it("sends only through the active session", async () => {
    const session = fakeSession()
    const registry = new SessionRegistry({
      findResumable: async () => null,
      createSession: () => session as unknown as BaileysSession,
    })
    await registry.connect({ organizationId, channelConnectionId })

    await expect(
      handleWaGatewayJob(registry, {
        name: "wa-send",
        data: {
          organizationId,
          channelConnectionId,
          outboundMessageId: "01K1EDN69NFBWCG42B2H99V2C5",
          to: "+5511888888888",
          body: "Oi",
        },
      })
    ).resolves.toEqual({ ok: true, externalMessageId: "wamid.out" })
    expect(session.sendText).toHaveBeenCalledWith(
      expect.objectContaining({ to: "+5511888888888", body: "Oi" })
    )
  })
})
