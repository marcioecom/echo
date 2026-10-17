import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("bullmq", async (importOriginal) => {
  const actual = await importOriginal<typeof import("bullmq")>()
  class MockWorker {
    on = vi.fn()
    close = vi.fn(async () => undefined)
    constructor(..._args: unknown[]) {
      void _args
    }
  }
  return { ...actual, Worker: MockWorker }
})

import { SessionLease } from "../ownership/lease"
import { SessionRegistry } from "../ownership/registry"
import type { SessionDirectory } from "../repositories/session-directory"
import type { BaileysSession } from "../session"
import { handleWaConnectionJob } from "./handle-connection-job"
import { handleWaGatewayJob } from "./handle-gateway-job"

const organizationId = "01K1EDN69NFBWCG42B2H99V2C1"
const channelConnectionId = "01K1EDN9C8VT0N8WRM13RM6M55"
const otherConnectionId = "01K1EDN69NFBWCG42B2H99V2C6"
const otherOrganizationId = "01K1EDN69NFBWCG42B2H99V2C7"

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

function fakeLease(token = "lease-token") {
  return {
    token,
    isValid: vi.fn(async () => true),
    release: vi.fn(async () => undefined),
    onLost: vi.fn(() => () => undefined),
  } as unknown as SessionLease
}

function fakeDirectory(
  overrides: Partial<SessionDirectory> = {}
): SessionDirectory {
  return {
    findResumable: async () => [],
    claim: async () => true,
    isOwner: async () => true,
    release: async () => true,
    setState: async () => true,
    markConnected: async () => true,
    ...overrides,
  }
}

describe("SessionRegistry", () => {
  beforeEach(() => {
    vi.spyOn(SessionLease, "acquire").mockImplementation(async (_redis, id) =>
      fakeLease(`token-${id}`)
    )
  })

  it("resumes every resumable connection", async () => {
    const sessions = [fakeSession(), fakeSession()]
    const registry = new SessionRegistry({
      redis: {} as never,
      directory: fakeDirectory({
        findResumable: async () => [
          { organizationId, channelConnectionId },
          { organizationId, channelConnectionId: otherConnectionId },
        ],
      }),
      ownerPod: "pod-a",
      openSession: async () => sessions.shift() as unknown as BaileysSession,
    })
    await registry.start()
    expect(sessions).toHaveLength(0)
  })

  it("connects a second channel while the first stays active", async () => {
    const sessions = [fakeSession(), fakeSession()]
    const registry = new SessionRegistry({
      redis: {} as never,
      directory: fakeDirectory(),
      ownerPod: "pod-a",
      openSession: async () => sessions.shift() as unknown as BaileysSession,
    })

    await handleWaGatewayJob(registry, {
      name: "wa-connect",
      data: { organizationId, channelConnectionId },
    })
    await handleWaGatewayJob(registry, {
      name: "wa-connect",
      data: { organizationId, channelConnectionId: otherConnectionId },
    })

    expect(sessions).toHaveLength(0)
  })

  it("sends only through the owned session", async () => {
    const session = fakeSession()
    const registry = new SessionRegistry({
      redis: {} as never,
      directory: fakeDirectory(),
      ownerPod: "pod-a",
      openSession: async () => session as unknown as BaileysSession,
    })
    await registry.connect({ organizationId, channelConnectionId })

    await expect(
      handleWaConnectionJob(registry, {
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

  it("rejects send for another organization", async () => {
    const session = fakeSession()
    const registry = new SessionRegistry({
      redis: {} as never,
      directory: fakeDirectory(),
      ownerPod: "pod-a",
      openSession: async () => session as unknown as BaileysSession,
    })
    await registry.connect({ organizationId, channelConnectionId })

    await expect(
      registry.send({
        organizationId: otherOrganizationId,
        channelConnectionId,
        to: "+5511888888888",
        body: "Oi",
      })
    ).resolves.toEqual({
      ok: false,
      retryable: true,
      code: "session_unavailable",
    })
    expect(session.sendText).not.toHaveBeenCalled()
  })
})
