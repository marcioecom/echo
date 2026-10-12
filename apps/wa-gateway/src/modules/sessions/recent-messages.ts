import { BufferJSON, type proto } from "@whiskeysockets/baileys"
import type { Redis } from "ioredis"

const MESSAGE_TTL_SECONDS = 86_400

export function recentMessageKey(
  channelConnectionId: string,
  externalMessageId: string
): string {
  return `wa:msg:${channelConnectionId}:${externalMessageId}`
}

export async function rememberRecentMessage(
  redis: Pick<Redis, "set">,
  input: {
    channelConnectionId: string
    externalMessageId: string
    message: unknown
  }
): Promise<void> {
  await redis.set(
    recentMessageKey(input.channelConnectionId, input.externalMessageId),
    JSON.stringify(input.message, BufferJSON.replacer),
    "EX",
    MESSAGE_TTL_SECONDS
  )
}

export async function recallRecentMessage(
  redis: Pick<Redis, "get">,
  input: { channelConnectionId: string; externalMessageId: string }
): Promise<proto.IMessage | undefined> {
  const raw = await redis.get(
    recentMessageKey(input.channelConnectionId, input.externalMessageId)
  )
  if (!raw) return undefined
  return JSON.parse(raw, BufferJSON.reviver) as proto.IMessage
}
