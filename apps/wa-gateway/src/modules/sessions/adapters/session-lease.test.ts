import { describe, expect, it } from "vitest"

import { InMemorySessionLease } from "./session-lease"

const connectionId = "01K1EDN9C8VT0N8WRM13RM6M55"

describe("session lease", () => {
  it("lets only one pod own a number", async () => {
    const leases = new InMemorySessionLease()
    const first = await leases.acquire(connectionId, "pod-a", 30_000)
    const second = await leases.acquire(connectionId, "pod-b", 30_000)

    expect(first.ok).toBe(true)
    expect(second).toEqual({ ok: false })
    if (!first.ok) return
    expect(await leases.renew(connectionId, first.lease, 30_000)).toBe(true)
    expect(await leases.release(connectionId, first.lease)).toBe(true)
  })

  it("fences the previous owner after the lease expires", async () => {
    let now = 0
    const leases = new InMemorySessionLease(() => now)
    const first = await leases.acquire(connectionId, "pod-a", 1_000)
    expect(first.ok).toBe(true)
    if (!first.ok) return

    now = 1_000
    const takeover = await leases.acquire(connectionId, "pod-b", 1_000)
    expect(takeover.ok).toBe(true)
    if (!takeover.ok) return
    expect(takeover.lease.token).not.toBe(first.lease.token)
    expect(await leases.renew(connectionId, first.lease, 1_000)).toBe(false)
    expect(await leases.release(connectionId, first.lease)).toBe(false)
    expect(await leases.renew(connectionId, takeover.lease, 1_000)).toBe(true)
  })

  it("frees the number as soon as the owner releases it", async () => {
    const leases = new InMemorySessionLease()
    const first = await leases.acquire(connectionId, "pod-a", 30_000)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(await leases.release(connectionId, first.lease)).toBe(true)

    const next = await leases.acquire(connectionId, "pod-b", 30_000)
    expect(next.ok).toBe(true)
    if (!next.ok) return
    expect(next.lease.token).not.toBe(first.lease.token)
    expect(await leases.renew(connectionId, first.lease, 30_000)).toBe(false)
  })
})
