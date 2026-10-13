import { describe, expect, it, vi } from "vitest"

import { InMemoryCommandBus } from "./adapters/session-commands"
import { InMemorySessionLease } from "./adapters/session-lease"
import { SessionManager } from "./session-manager"
import type { BaileysSession } from "./session"
import type { ConnectionRef } from "./types"

const organizationId = "01K1EDN69NFBWCG42B2H99V2C1"
const firstId = "01K1EDN9C8VT0N8WRM13RM6M55"
const secondId = "01K1EDN69NFBWCG42B2H99V2C6"
const thirdId = "01K1EDN69NFBWCG42B2H99V2C7"

function connection(channelConnectionId: string): ConnectionRef {
  return { organizationId, channelConnectionId }
}

function fakeSession() {
  let resolveRun: () => void = () => undefined
  const done = new Promise<void>((resolve) => {
    resolveRun = resolve
  })
  return {
    run: vi.fn(() => done),
    stop: vi.fn(async () => resolveRun()),
    logout: vi.fn(async () => resolveRun()),
    requestPairingCode: vi.fn(async () => undefined),
    sendText: vi.fn(async () => ({
      ok: true as const,
      externalMessageId: "wamid.out",
    })),
  }
}

function setup(maxSessions = 50) {
  let now = 0
  const leases = new InMemorySessionLease(() => now)
  const bus = new InMemoryCommandBus()
  const owners = new Map<string, string | null>()
  const sessions = new Map<string, ReturnType<typeof fakeSession>>()
  let claimable = [connection(firstId), connection(secondId)]

  function manager(podId: string) {
    return new SessionManager({
      podId,
      maxSessions,
      leaseTtlMs: 30_000,
      renewIntervalMs: 5_000,
      commandTimeoutMs: 50,
      leases,
      bus,
      listClaimable: async () => claimable,
      setOwner: async (connection, ownerPod) => {
        owners.set(connection.channelConnectionId, ownerPod)
      },
      createSession: (connection) => {
        const session = fakeSession()
        sessions.set(`${podId}:${connection.channelConnectionId}`, session)
        return session as unknown as BaileysSession
      },
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    })
  }

  return {
    leases,
    owners,
    sessions,
    manager,
    advance: (ms: number) => {
      now += ms
    },
    setClaimable: (next: ConnectionRef[]) => {
      claimable = next
    },
  }
}

describe("SessionManager", () => {
  it("gives each number to one pod", async () => {
    const harness = setup()
    const podA = harness.manager("pod-a")
    const podB = harness.manager("pod-b")

    await Promise.all([podA.reconcile(), podB.reconcile()])

    const owners = [...harness.sessions.keys()]
    expect(owners.filter((key) => key.endsWith(firstId))).toHaveLength(1)
    expect(owners.filter((key) => key.endsWith(secondId))).toHaveLength(1)
    expect(harness.owners.get(firstId)).toEqual(expect.any(String))
    expect(harness.owners.get(secondId)).toEqual(expect.any(String))
  })

  it("stops the old socket when another pod takes over", async () => {
    const harness = setup()
    harness.setClaimable([connection(firstId)])
    const podA = harness.manager("pod-a")
    const podB = harness.manager("pod-b")
    await podA.reconcile()
    const original = harness.sessions.get(`pod-a:${firstId}`)

    harness.leases.expire(firstId)
    await podB.reconcile()
    await podA.reconcile()

    expect(original?.stop).toHaveBeenCalledOnce()
    expect(original?.logout).not.toHaveBeenCalled()
    expect(harness.sessions.has(`pod-b:${firstId}`)).toBe(true)
    expect(harness.owners.get(firstId)).toBe("pod-b")
  })

  it("releases the lease on shutdown without logging out", async () => {
    const harness = setup()
    harness.setClaimable([connection(firstId)])
    const podA = harness.manager("pod-a")
    const podB = harness.manager("pod-b")
    await podA.reconcile()
    const original = harness.sessions.get(`pod-a:${firstId}`)

    await podA.stop()
    await podB.reconcile()

    expect(original?.stop).toHaveBeenCalledOnce()
    expect(original?.logout).not.toHaveBeenCalled()
    expect(harness.sessions.has(`pod-b:${firstId}`)).toBe(true)
    expect(harness.owners.get(firstId)).toBe("pod-b")
  })

  it("keeps renewing while draining and leaves new numbers for another pod", async () => {
    const harness = setup()
    harness.setClaimable([connection(firstId)])
    const podA = harness.manager("pod-a")
    const podB = harness.manager("pod-b")
    await podA.reconcile()
    await podA.pause()
    harness.advance(20_000)
    harness.setClaimable([connection(firstId), connection(thirdId)])
    await podA.reconcile()
    harness.advance(20_000)
    await podB.reconcile()

    expect(harness.sessions.has(`pod-a:${firstId}`)).toBe(true)
    expect(harness.sessions.has(`pod-b:${firstId}`)).toBe(false)
    expect(harness.sessions.has(`pod-b:${thirdId}`)).toBe(true)
  })

  it("does not take more sessions than the pod allows", async () => {
    const harness = setup(1)
    const podA = harness.manager("pod-a")
    await podA.reconcile()

    expect(harness.sessions.size).toBe(1)
    expect(harness.owners.size).toBe(1)
  })

  it("delivers a send to the pod that owns the session", async () => {
    const harness = setup()
    harness.setClaimable([connection(firstId)])
    const podA = harness.manager("pod-a")
    const podB = harness.manager("pod-b")
    await podA.reconcile()

    await expect(
      podB.send({
        ...connection(firstId),
        to: "+5511888888888",
        body: "Oi",
      })
    ).resolves.toEqual({ ok: true, externalMessageId: "wamid.out" })
    expect(
      harness.sessions.get(`pod-a:${firstId}`)?.sendText
    ).toHaveBeenCalledWith(
      expect.objectContaining({ to: "+5511888888888", body: "Oi" })
    )
  })

  it("returns a retryable send when nobody owns the session", async () => {
    const harness = setup()
    harness.setClaimable([])
    const podA = harness.manager("pod-a")

    await expect(
      podA.send({
        ...connection(firstId),
        to: "+5511888888888",
        body: "Oi",
      })
    ).resolves.toEqual({
      ok: false,
      retryable: true,
      code: "session_unavailable",
    })
  })
})
