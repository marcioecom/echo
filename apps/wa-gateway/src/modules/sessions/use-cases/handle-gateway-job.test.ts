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

  it("opens one session for the same connection across two registries", async () => {
    const lease = fakeLease()
    let acquired = false
    vi.spyOn(SessionLease, "acquire").mockImplementation(async () => {
      if (acquired) return null
      acquired = true
      return lease
    })
    const firstSession = fakeSession()
    const secondSession = fakeSession()
    const firstOpen = vi.fn(async () => firstSession as unknown as BaileysSession)
    const secondOpen = vi.fn(async () => secondSession as unknown as BaileysSession)
    const first = new SessionRegistry({
      redis: {} as never,
      directory: fakeDirectory(),
      ownerPod: "pod-a",
      openSession: firstOpen,
    })
    const second = new SessionRegistry({
      redis: {} as never,
      directory: fakeDirectory(),
      ownerPod: "pod-b",
      openSession: secondOpen,
    })

    await Promise.all([
      first.connect({ organizationId, channelConnectionId }),
      second.connect({ organizationId, channelConnectionId }),
    ])

    expect(firstOpen).toHaveBeenCalledOnce()
    expect(secondOpen).not.toHaveBeenCalled()
  })
  it("releases the lease when the database claim fails", async () => {
    const lease = fakeLease()
    vi.spyOn(SessionLease, "acquire").mockResolvedValue(lease)
    const registry = new SessionRegistry({
      redis: {} as never,
      directory: fakeDirectory({
        claim: async () => {
          throw new Error("database unavailable")
        },
      }),
      ownerPod: "pod-a",
      openSession: async () => fakeSession() as unknown as BaileysSession,
    })

    await expect(registry.connect({ organizationId, channelConnectionId })).rejects.toThrow(
      "database unavailable"
    )
    expect(lease.release).toHaveBeenCalledOnce()
  })

  it("releases lease and database ownership when session setup fails", async () => {
    const lease = fakeLease()
    vi.spyOn(SessionLease, "acquire").mockResolvedValue(lease)
    const release = vi.fn(async () => true)
    const registry = new SessionRegistry({
      redis: {} as never,
      directory: fakeDirectory({ release }),
      ownerPod: "pod-a",
      openSession: async () => {
        throw new Error("auth load failed")
      },
    })

    await expect(registry.connect({ organizationId, channelConnectionId })).rejects.toThrow(
      "auth load failed"
    )
    expect(release).toHaveBeenCalledWith({
      organizationId,
      channelConnectionId,
      ownerToken: "lease-token",
    })
    expect(lease.release).toHaveBeenCalledOnce()
  })

  it("releases a lease when shutdown overlaps lease acquisition", async () => {
    const lease = fakeLease()
    let resolveAcquire!: (value: SessionLease) => void
    const acquire = new Promise<SessionLease>((resolve) => {
      resolveAcquire = resolve
    })
    vi.spyOn(SessionLease, "acquire").mockImplementation(() => acquire)
    const claim = vi.fn(async () => true)
    const registry = new SessionRegistry({
      redis: {} as never,
      directory: fakeDirectory({ claim }),
      ownerPod: "pod-a",
      openSession: async () => fakeSession() as unknown as BaileysSession,
    })

    const connecting = registry.connect({ organizationId, channelConnectionId })
    const stopping = registry.stop()
    resolveAcquire(lease)
    await Promise.all([connecting, stopping])

    expect(claim).not.toHaveBeenCalled()
    expect(lease.release).toHaveBeenCalledOnce()
  })

  it("releases claimed ownership when shutdown overlaps database claim", async () => {
    const lease = fakeLease()
    vi.spyOn(SessionLease, "acquire").mockResolvedValue(lease)
    let resolveClaim!: (claimed: boolean) => void
    const claimResult = new Promise<boolean>((resolve) => {
      resolveClaim = resolve
    })
    const claim = vi.fn(() => claimResult)
    const release = vi.fn(async () => true)
    const openSession = vi.fn(async () => fakeSession() as unknown as BaileysSession)
    const registry = new SessionRegistry({
      redis: {} as never,
      directory: fakeDirectory({ claim, release }),
      ownerPod: "pod-a",
      openSession,
    })

    const connecting = registry.connect({ organizationId, channelConnectionId })
    await vi.waitFor(() => expect(claim).toHaveBeenCalledOnce())
    const stopping = registry.stop()
    resolveClaim(true)
    await Promise.all([connecting, stopping])

    expect(openSession).not.toHaveBeenCalled()
    expect(release).toHaveBeenCalledOnce()
    expect(lease.release).toHaveBeenCalledOnce()
  })

  it("observes rejected session tasks and releases ownership", async () => {
    const session = fakeSession()
    session.run = vi.fn(() => Promise.reject(new Error("session failed")))
    const release = vi.fn(async () => true)
    const registry = new SessionRegistry({
      redis: {} as never,
      directory: fakeDirectory({ release }),
      ownerPod: "pod-a",
      openSession: async () => session as unknown as BaileysSession,
    })

    await registry.connect({ organizationId, channelConnectionId })
    await vi.waitFor(() => expect(session.stop).toHaveBeenCalledOnce())
    await vi.waitFor(() => expect(release).toHaveBeenCalledOnce())
  })
})
