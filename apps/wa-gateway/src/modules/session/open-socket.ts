import makeWASocket, {
  Browsers,
  BufferJSON,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  type proto,
} from "@whiskeysockets/baileys"
import type { Redis } from "ioredis"

import type { EchoAuthState } from "../auth/use-echo-auth-state"
import { createBaileysLogger } from "./baileys-logger"
import type { SessionSocket } from "./session-runner"

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

export async function openBaileysSocket(input: {
  auth: EchoAuthState
  getMessage: (externalMessageId: string) => Promise<proto.IMessage | undefined>
}): Promise<SessionSocket> {
  const fetched = await fetchLatestBaileysVersion().catch(() => null)
  const logger = createBaileysLogger()
  return makeWASocket({
    auth: {
      creds: input.auth.state.creds,
      keys: makeCacheableSignalKeyStore(input.auth.state.keys, logger),
    },
    logger,
    printQRInTerminal: false,
    markOnlineOnConnect: false,
    syncFullHistory: false,
    shouldSyncHistoryMessage: () => false,
    browser: Browsers.macOS("Echo"),
    ...(fetched ? { version: fetched.version } : {}),
    cachedGroupMetadata: async () => undefined,
    getMessage: async (key) => {
      if (!key.id) return undefined
      return input.getMessage(key.id)
    },
  })
}
