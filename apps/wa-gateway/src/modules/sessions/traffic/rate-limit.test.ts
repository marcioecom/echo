import { describe, expect, it } from "vitest"

import {
  acquireSendSlot,
  claimInboundMessage,
  hasSeenInboundMessage,
} from "./rate-limit"
import type { RateLimitRedis } from "./rate-limit"

function memoryRedis(): RateLimitRedis & { keys: Set<string> } {
  const keys = new Set<string>()
  return {
    keys,
    async get(key) {
      return keys.has(key) ? "1" : null
    },
    async set(key, _value, _mode, _ttl, existence) {
      if (existence === "NX" && keys.has(key)) return null
      keys.add(key)
      return "OK"
    },
  }

}

describe("acquireSendSlot", () => {
  it("allows one send per connection and per contact window", async () => {
    const redis = memoryRedis()
    const input = {
      channelConnectionId: "01K1EDN9C8VT0N8WRM13RM6M55",
      to: "+5511888888888",
      connectionIntervalMs: 1_000,
      contactIntervalMs: 3_000,
    }

    await expect(acquireSendSlot(redis, input)).resolves.toBe("ok")
    await expect(acquireSendSlot(redis, input)).resolves.toBe("connection")
  })

  it("limits the same contact after the connection window is free", async () => {
    const redis = memoryRedis()
    const first = {
      channelConnectionId: "01K1EDN9C8VT0N8WRM13RM6M55",
      to: "+5511888888888",
      connectionIntervalMs: 1_000,
      contactIntervalMs: 3_000,
    }
    await acquireSendSlot(redis, first)
    redis.keys.delete(`wa:rate:connection:${first.channelConnectionId}`)

    await expect(acquireSendSlot(redis, first)).resolves.toBe("contact")
  })
})

describe("claimInboundMessage", () => {
  it("accepts an external id once", async () => {
    const redis = memoryRedis()
    const input = {
      channelConnectionId: "01K1EDN9C8VT0N8WRM13RM6M55",
      externalMessageId: "wamid.1",
    }
    await expect(claimInboundMessage(redis, input)).resolves.toBe(true)
    await expect(claimInboundMessage(redis, input)).resolves.toBe(false)
  })

  it("reads the Redis seen key before an inbound enqueue", async () => {
    const redis = memoryRedis()
    const input = {
      channelConnectionId: "01K1EDN9C8VT0N8WRM13RM6M55",
      externalMessageId: "wamid.1",
    }

    await expect(hasSeenInboundMessage(redis, input)).resolves.toBe(false)
    await claimInboundMessage(redis, input)
    await expect(hasSeenInboundMessage(redis, input)).resolves.toBe(true)
  })
})
