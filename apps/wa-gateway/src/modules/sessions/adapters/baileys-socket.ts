import makeWASocket, {
  Browsers,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  type proto,
} from "@whiskeysockets/baileys"

import type { EchoAuthState } from "../auth-state"
import type { SessionSocket } from "../types"
import { createBaileysLogger } from "./baileys-logger"

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
    browser: Browsers.macOS("Echo"),
    ...(fetched ? { version: fetched.version } : {}),
    cachedGroupMetadata: async () => undefined,
    getMessage: async (key) => {
      if (!key.id) return undefined
      return input.getMessage(key.id)
    },
  })
}
