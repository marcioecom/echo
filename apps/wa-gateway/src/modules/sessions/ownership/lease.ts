import { createId } from "@workspace/domain"
import type { Redis } from "ioredis"

const ttlMs = 30_000
const renewMs = 10_000
const commandTimeoutMs = 2_000
const renewScript = `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('PEXPIRE', KEYS[1], ARGV[2]) else return 0 end`
const releaseScript = `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end`

export class SessionLease {
  private valid = true
  private expiresAt: number
  private readonly timer: NodeJS.Timeout
  private expiryTimer: NodeJS.Timeout
  private readonly listeners = new Set<() => void>()

  private constructor(
    private readonly redis: Redis,
    private readonly key: string,
    readonly token: string,
    acquiredAt: number
  ) {
    this.expiresAt = acquiredAt + ttlMs
    this.expiryTimer = setTimeout(() => this.lose(), ttlMs - (Date.now() - acquiredAt))
    this.timer = setInterval(() => void this.renew(), renewMs)
    this.timer.unref()
    this.expiryTimer.unref()
  }

  static async acquire(redis: Redis, channelConnectionId: string): Promise<SessionLease | null> {
    const key = `wa:lease:${channelConnectionId}`
    const token = createId()
    const startedAt = Date.now()
    const acquired = await bounded(redis.set(key, token, "PX", ttlMs, "NX"))
    if (acquired !== "OK") return null
    return new SessionLease(redis, key, token, startedAt)
  }

  onLost(listener: () => void): () => void {
    if (!this.valid) listener()
    else this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async isValid(): Promise<boolean> {
    if (!this.valid || Date.now() >= this.expiresAt) {
      this.lose()
      return false
    }
    try {
      if (await bounded(this.redis.get(this.key)) !== this.token) this.lose()
    } catch {
      this.lose()
    }
    if (Date.now() >= this.expiresAt) this.lose()
    return this.valid
  }

  async release(): Promise<void> {
    this.lose()
    await bounded(this.redis.eval(releaseScript, 1, this.key, this.token))
  }

  private async renew(): Promise<void> {
    if (!this.valid) return
    const startedAt = Date.now()
    try {
      const renewed = await bounded(this.redis.eval(renewScript, 1, this.key, this.token, ttlMs))
      if (!this.valid) return
      if (renewed !== 1 || Date.now() >= this.expiresAt) {
        this.lose()
        return
      }
      this.expiresAt = startedAt + ttlMs
      clearTimeout(this.expiryTimer)
      this.expiryTimer = setTimeout(() => this.lose(), this.expiresAt - Date.now())
      this.expiryTimer.unref()
    } catch {
      this.lose()
    }
  }

  private lose(): void {
    if (!this.valid) return
    this.valid = false
    clearInterval(this.timer)
    clearTimeout(this.expiryTimer)
    for (const listener of this.listeners) listener()
    this.listeners.clear()
  }
}

async function bounded<T>(command: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  try {
    return await Promise.race([
      command,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Redis lease command timed out")), commandTimeoutMs)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}
