export interface RateLimitRedis {
  get(key: string): Promise<string | null>
  set(
    key: string,
    value: string,
    expiryMode: "PX",
    ttlMs: number,
    existence: "NX"
  ): Promise<"OK" | null>
}

export async function acquireSendSlot(
  redis: RateLimitRedis,
  input: {
    channelConnectionId: string
    to: string
    connectionIntervalMs: number
    contactIntervalMs: number
  }
): Promise<"ok" | "connection" | "contact"> {
  const connectionKey = `wa:rate:connection:${input.channelConnectionId}`
  const connection = await redis.set(
    connectionKey,
    "1",
    "PX",
    input.connectionIntervalMs,
    "NX"
  )
  if (connection !== "OK") return "connection"

  const contactKey = `wa:rate:contact:${input.channelConnectionId}:${input.to}`
  const contact = await redis.set(
    contactKey,
    "1",
    "PX",
    input.contactIntervalMs,
    "NX"
  )
  if (contact !== "OK") return "contact"
  return "ok"
}

export function seenMessageKey(
  channelConnectionId: string,
  externalMessageId: string
): string {
  return `wa:seen:${channelConnectionId}:${externalMessageId}`
}

export async function claimInboundMessage(
  redis: RateLimitRedis,
  input: { channelConnectionId: string; externalMessageId: string }
): Promise<boolean> {
  const result = await redis.set(
    seenMessageKey(input.channelConnectionId, input.externalMessageId),
    "1",
    "PX",
    86_400_000,
    "NX"
  )
  return result === "OK"
}

export async function hasSeenInboundMessage(
  redis: RateLimitRedis,
  input: { channelConnectionId: string; externalMessageId: string }
): Promise<boolean> {
  return (
    (await redis.get(
      seenMessageKey(input.channelConnectionId, input.externalMessageId)
    )) !== null
  )
}
