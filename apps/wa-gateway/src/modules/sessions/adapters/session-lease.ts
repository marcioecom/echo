// One WhatsApp number, one owner. The lease value is `{token}|{podId}`.
// The token only increases, so a pod that lost the key cannot refresh it.

export interface SessionLease {
  podId: string
  token: string
}

export type AcquireResult = { ok: true; lease: SessionLease } | { ok: false }

export interface SessionLeaseStore {
  acquire(
    connectionId: string,
    podId: string,
    ttlMs: number
  ): Promise<AcquireResult>
  renew(
    connectionId: string,
    lease: SessionLease,
    ttlMs: number
  ): Promise<boolean>
  release(connectionId: string, lease: SessionLease): Promise<boolean>
}

export interface LeaseRedis {
  eval(
    script: string,
    numKeys: number,
    ...args: Array<string | number>
  ): Promise<unknown>
}

interface LeaseEntry {
  value: string
  expiresAt: number
}

const ACQUIRE_LEASE = `
local current = redis.call('GET', KEYS[1])
if current then
  return 0
end
local token = redis.call('INCR', KEYS[2])
local value = token .. '|' .. ARGV[1]
redis.call('SET', KEYS[1], value, 'PX', ARGV[2])
return value
`

const RENEW_LEASE = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then
  return 0
end
redis.call('PEXPIRE', KEYS[1], ARGV[2])
return 1
`

const RELEASE_LEASE = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`

export function leaseKey(connectionId: string): string {
  return `wa:lease:${connectionId}`
}

export function fenceKey(connectionId: string): string {
  return `wa:fence:${connectionId}`
}

export function formatLease(lease: SessionLease): string {
  return `${lease.token}|${lease.podId}`
}

export function parseLease(value: string): SessionLease | null {
  const split = value.indexOf("|")
  if (split <= 0) return null
  const token = value.slice(0, split)
  const podId = value.slice(split + 1)
  if (!/^\d+$/.test(token) || podId.length === 0) return null
  return { token, podId }
}

export class InMemorySessionLease implements SessionLeaseStore {
  private readonly entries = new Map<string, LeaseEntry>()
  private readonly fences = new Map<string, number>()

  constructor(private readonly now: () => number = Date.now) {}

  async acquire(
    connectionId: string,
    podId: string,
    ttlMs: number
  ): Promise<AcquireResult> {
    if (this.read(connectionId)) return { ok: false }
    const token = (this.fences.get(connectionId) ?? 0) + 1
    this.fences.set(connectionId, token)
    const lease = { token: String(token), podId }
    this.entries.set(connectionId, {
      value: formatLease(lease),
      expiresAt: this.now() + ttlMs,
    })
    return { ok: true, lease }
  }

  async renew(
    connectionId: string,
    lease: SessionLease,
    ttlMs: number
  ): Promise<boolean> {
    const entry = this.read(connectionId)
    if (!entry || entry.value !== formatLease(lease)) return false
    entry.expiresAt = this.now() + ttlMs
    return true
  }

  async release(connectionId: string, lease: SessionLease): Promise<boolean> {
    const entry = this.read(connectionId)
    if (!entry || entry.value !== formatLease(lease)) return false
    this.entries.delete(connectionId)
    return true
  }

  expire(connectionId: string): void {
    this.entries.delete(connectionId)
  }

  private read(connectionId: string): LeaseEntry | null {
    const entry = this.entries.get(connectionId)
    if (!entry) return null
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(connectionId)
      return null
    }
    return entry
  }
}

export class RedisSessionLease implements SessionLeaseStore {
  constructor(private readonly redis: LeaseRedis) {}

  async acquire(
    connectionId: string,
    podId: string,
    ttlMs: number
  ): Promise<AcquireResult> {
    const raw = await this.redis.eval(
      ACQUIRE_LEASE,
      2,
      leaseKey(connectionId),
      fenceKey(connectionId),
      podId,
      String(ttlMs)
    )
    if (typeof raw !== "string") return { ok: false }
    const lease = parseLease(raw)
    if (!lease || lease.podId !== podId) return { ok: false }
    return { ok: true, lease }
  }

  async renew(
    connectionId: string,
    lease: SessionLease,
    ttlMs: number
  ): Promise<boolean> {
    const raw = await this.redis.eval(
      RENEW_LEASE,
      1,
      leaseKey(connectionId),
      formatLease(lease),
      String(ttlMs)
    )
    return Number(raw) === 1
  }

  async release(connectionId: string, lease: SessionLease): Promise<boolean> {
    const raw = await this.redis.eval(
      RELEASE_LEASE,
      1,
      leaseKey(connectionId),
      formatLease(lease)
    )
    return Number(raw) === 1
  }
}
