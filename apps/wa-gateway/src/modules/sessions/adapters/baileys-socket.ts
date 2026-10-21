import type { EchoAuthState } from "../auth-state"
import type { DownloadedMedia, SessionSocket } from "../types"
import type { proto } from "@whiskeysockets/baileys"

import makeWASocket, {
  Browsers,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from "@whiskeysockets/baileys"

import { createBaileysLogger } from "./baileys-logger"

export class MediaUnavailableError extends Error {
  constructor(reason: "socket_unavailable" | "message_unavailable") {
    super(reason)
    this.name = "MediaUnavailableError"
  }
}

export async function openBaileysSocket(input: {
  auth: EchoAuthState
  getMessage: (externalMessageId: string) => Promise<proto.IMessage | undefined>
}): Promise<SessionSocket> {
  const fetched = await fetchLatestBaileysVersion().catch(() => null)
  const logger = createBaileysLogger()
  const sock = makeWASocket({
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

  const downloadMedia = async (media: {
    externalMessageId: string
    senderAddress: string
  }): Promise<DownloadedMedia> => {
    if (!sock.user?.id) throw new MediaUnavailableError("socket_unavailable")
    const message = await input.getMessage(media.externalMessageId)
    if (!message) throw new MediaUnavailableError("message_unavailable")
    const remoteJid = `${media.senderAddress.slice(1)}@s.whatsapp.net`
    const buffer = await downloadMediaMessage(
      {
        key: { id: media.externalMessageId, remoteJid },
        message,
      },
      "buffer",
      {},
      {
        logger,
        reuploadRequest: (target) => sock.updateMediaMessage(target),
      }
    )
    return {
      bytes: new Uint8Array(buffer),
      mimeType: message.audioMessage?.mimetype ?? "",
    }
  }

  return Object.assign(sock, { downloadMedia })
}
