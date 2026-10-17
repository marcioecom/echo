export type InboundMediaKind =
  | "image"
  | "audio"
  | "video"
  | "document"
  | "unknown"

export interface RawInboundKey {
  id?: string | null
  fromMe?: boolean | null
  remoteJid?: string | null
  remoteJidAlt?: string | null
}

export interface RawInboundMessage {
  key: RawInboundKey
  pushName?: string | null
  message?: unknown
}

export type FilteredInbound =
  | { action: "ignore" }
  | {
      action: "accept"
      externalMessageId: string
      senderAddress: string
      senderDisplayName?: string
      content:
        | { type: "text"; body: string }
        | { type: "unsupported"; mediaKind: InboundMediaKind }
    }

export function filterInboundUpsert(input: {
  type: string
  messages: RawInboundMessage[]
}): FilteredInbound[] {
  if (input.type !== "notify") {
    return input.messages.map(() => ({ action: "ignore" }))
  }
  return input.messages.map((message) => filterMessage(message))
}

export function phoneFromJid(jid: string | null | undefined): string | null {
  if (!jid?.endsWith("@s.whatsapp.net")) return null
  const user = jid.slice(0, jid.indexOf("@")).split(":")[0] ?? ""
  if (!/^[1-9]\d{7,14}$/.test(user)) return null
  return `+${user}`
}

function filterMessage(message: RawInboundMessage): FilteredInbound {
  const key = message.key
  if (!key.id || key.fromMe) return { action: "ignore" }
  if (isIgnoredChat(key.remoteJid) || isIgnoredChat(key.remoteJidAlt)) {
    return { action: "ignore" }
  }

  const senderAddress =
    phoneFromJid(key.remoteJid) ?? phoneFromJid(key.remoteJidAlt)
  if (!senderAddress) return { action: "ignore" }

  const content = contentFromMessage(message.message)
  if (!content) return { action: "ignore" }

  const senderDisplayName = message.pushName?.trim()
  return {
    action: "accept",
    externalMessageId: key.id,
    senderAddress,
    ...(senderDisplayName ? { senderDisplayName } : {}),
    content,
  }
}

function isIgnoredChat(jid: string | null | undefined): boolean {
  if (!jid) return false
  return (
    jid === "status@broadcast" ||
    jid.endsWith("@g.us") ||
    jid.endsWith("@broadcast") ||
    jid.endsWith("@newsletter")
  )
}

function contentFromMessage(
  message: unknown
):
  | { type: "text"; body: string }
  | { type: "unsupported"; mediaKind: InboundMediaKind }
  | null {
  if (!message || typeof message !== "object") return null
  const record = message as Record<string, unknown>
  const text = textBody(record)
  if (text) return { type: "text", body: text }
  if (record.imageMessage || record.stickerMessage) {
    return { type: "unsupported", mediaKind: "image" }
  }
  if (record.audioMessage) return { type: "unsupported", mediaKind: "audio" }
  if (record.videoMessage) return { type: "unsupported", mediaKind: "video" }
  if (record.documentMessage) {
    return { type: "unsupported", mediaKind: "document" }
  }
  return null
}

function textBody(message: Record<string, unknown>): string | null {
  if (typeof message.conversation === "string" && message.conversation.trim()) {
    return message.conversation.trim()
  }
  const extended = message.extendedTextMessage
  if (
    extended &&
    typeof extended === "object" &&
    "text" in extended &&
    typeof extended.text === "string" &&
    extended.text.trim()
  ) {
    return extended.text.trim()
  }
  return null
}
