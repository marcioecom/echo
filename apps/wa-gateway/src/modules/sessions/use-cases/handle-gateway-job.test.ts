import { UnrecoverableError } from "bullmq"
import { describe, expect, it, vi } from "vitest"

import { InMemoryCommandBus } from "../adapters/session-commands"
import { InMemorySessionLease } from "../adapters/session-lease"
import { SessionManager } from "../session-manager"
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

function managerFor(sessions: Map<string, ReturnType<typeof fakeSession>>) {
  return new SessionManager({
    podId: "pod-a",
    maxSessions: 10,
    leaseTtlMs: 30_000,
    renewIntervalMs: 5_000,
    leases: new InMemorySessionLease(),
    bus: new InMemoryCommandBus(),
    listClaimable: async () => [],
    setOwner: async () => undefined,
    createSession: (connection) => {
      const session = fakeSession()
      sessions.set(connection.channelConnectionId, session)
      return session as unknown as BaileysSession
    },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  })
}

describe("handleWaGatewayJob", () => {
  it("opens more than one session and sends through the matching one", async () => {
    const sessions = new Map<string, ReturnType<typeof fakeSession>>()
    const manager = managerFor(sessions)

    await handleWaGatewayJob(manager, {
      name: "wa-connect",
      data: { organizationId, channelConnectionId },
    })
    await handleWaGatewayJob(manager, {
      name: "wa-connect",
      data: { organizationId, channelConnectionId: otherConnectionId },
    })
    expect(sessions.size).toBe(2)

    await expect(
      handleWaGatewayJob(manager, {
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
    expect(sessions.get(channelConnectionId)?.sendText).toHaveBeenCalledWith(
      expect.objectContaining({ to: "+5511888888888", body: "Oi" })
    )
    expect(sessions.get(otherConnectionId)?.sendText).not.toHaveBeenCalled()
  })

  it("rejects an unknown job", async () => {
    const manager = managerFor(new Map())
    await expect(
      handleWaGatewayJob(manager, { name: "wa-nope", data: {} })
    ).rejects.toBeInstanceOf(UnrecoverableError)
  })
})
