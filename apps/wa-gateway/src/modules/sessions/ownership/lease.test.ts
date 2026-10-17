import type { Redis } from "ioredis"
import { afterEach, describe, expect, it, vi } from "vitest"

import { SessionLease } from "./lease"

describe("session lease", () => {
  afterEach(() => vi.useRealTimers())

  it("stops a stale owner and cannot release its replacement's lease", async () => {
    vi.useFakeTimers()
    let value: string | null = null
    const redis = {
      set: vi.fn(async (_key: string, token: string) => {
        if (value) return null
        value = token
        return "OK"
      }),
      get: vi.fn(async () => value),
      eval: vi.fn(async (script: string, _count: number, _key: string, token: string) => {
        if (value !== token) return 0
        if (script.includes("DEL")) value = null
        return 1
      }),
    } as unknown as Redis
    const owner = await SessionLease.acquire(redis, "connection-A")
    expect(owner).not.toBeNull()
    expect(await SessionLease.acquire(redis, "connection-A")).toBeNull()
    const lost = vi.fn()
    owner!.onLost(lost)
    value = "replacement-token"
    expect(await owner!.isValid()).toBe(false)
    expect(lost).toHaveBeenCalledOnce()
    await owner!.release()
    expect(value).toBe("replacement-token")
  })

  it("fails closed when renewal cannot reach Redis", async () => {
    vi.useFakeTimers()
    const redis = {
      set: vi.fn(async () => "OK"),
      eval: vi.fn(async () => { throw new Error("offline") }),
    } as unknown as Redis
    const owner = await SessionLease.acquire(redis, "connection-A")
    const lost = vi.fn()
    owner!.onLost(lost)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(lost).toHaveBeenCalledOnce()
    expect(await owner!.isValid()).toBe(false)
  })
})
