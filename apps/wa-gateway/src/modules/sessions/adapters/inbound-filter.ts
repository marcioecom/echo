import type { InboundMessageContent } from "@workspace/domain"

import {
  isSupportedInboundAudioMimeType,
  normalizeAudioMimeType,
} from "@workspace/domain"

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
      content: InboundMessageContent
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

  const content = contentFromMessage(message.message, key.id)
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
  message: unknown,
  externalMessageId: string
): InboundMessageContent | null {
  if (!message || typeof message !== "object") return null
  const record = message as Record<string, unknown>
  const text = textBody(record)
  if (text) return { type: "text", body: text }
  if (record.imageMessage || record.stickerMessage) {
    return { type: "unsupported", mediaKind: "image" }
  }
  if (record.audioMessage) {
    return audioContent(record.audioMessage, externalMessageId)
  }
  if (record.videoMessage) return { type: "unsupported", mediaKind: "video" }
  if (record.documentMessage) {
    return { type: "unsupported", mediaKind: "document" }
  }
  return null
}

function audioContent(
  audioMessage: unknown,
  externalMessageId: string
): InboundMessageContent {
  if (!audioMessage || typeof audioMessage !== "object") {
    return { type: "unsupported", mediaKind: "audio" }
  }
  const record = audioMessage as Record<string, unknown>
  const rawMimeType =
    typeof record.mimetype === "string" ? record.mimetype.trim() : ""
  if (!rawMimeType || !isSupportedInboundAudioMimeType(rawMimeType)) {
    return { type: "unsupported", mediaKind: "audio" }
  }
  const mimeType = normalizeAudioMimeType(rawMimeType)
  const seconds = positiveNumber(record.seconds)
  const sizeBytes = positiveSafeInteger(record.fileLength)
  const durationMs =
    seconds === null ? null : Math.max(1, Math.round(seconds * 1000))
  return {
    type: "audio",
    media: {
      mimeType,
      ...(sizeBytes === null ? {} : { sizeBytes }),
      ...(durationMs === null ? {} : { durationMs }),
      ref: { externalMessageId },
    },
  }
}

function positiveNumber(value: unknown): number | null {
  const numeric = numericValue(value)
  if (numeric === null) return null
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null
}

function positiveSafeInteger(value: unknown): number | null {
  const numeric = numericValue(value)
  if (numeric === null) return null
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : null
}

function numericValue(value: unknown): number | null {
  if (typeof value === "number") return value
  if (typeof value === "string" && value.trim()) return Number(value)
  if (value && typeof value === "object") {
    const convertible = value as {
      toNumber?: unknown
      low?: unknown
      high?: unknown
    }
    if (typeof convertible.toNumber === "function") {
      const converted = (convertible.toNumber as () => unknown)()
      return numericValue(converted)
    }
    if (typeof convertible.low === "number") {
      const high = typeof convertible.high === "number" ? convertible.high : 0
      return high === 0
        ? convertible.low
        : high * 2 ** 32 + (convertible.low >>> 0)
    }
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
