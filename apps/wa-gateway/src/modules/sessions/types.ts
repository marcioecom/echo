import type { RawInboundMessage } from "./adapters/inbound-filter"
import type { WaMediaDownloadResult } from "@workspace/jobs"

export interface ConnectionRef {
  organizationId: string
  channelConnectionId: string
}

export interface SessionLogger {
  info: (message: string, data?: Record<string, unknown>) => void
  warn: (message: string, data?: Record<string, unknown>) => void
  error: (message: string, data?: Record<string, unknown>) => void
}

export interface DownloadedMedia {
  bytes: Uint8Array
  mimeType: string
}

export type MediaDownloadResult = WaMediaDownloadResult

export interface SessionSocket {
  ev: {
    process: (handler: (events: SessionEvents) => void | Promise<void>) => void
  }
  user?: { id: string }
  sendMessage: (
    jid: string,
    content: { text: string }
  ) => Promise<{ key?: { id?: string | null } } | undefined>
  sendPresenceUpdate: (
    type: "composing" | "paused",
    jid?: string
  ) => Promise<void>
  requestPairingCode: (phoneNumber: string) => Promise<string>
  downloadMedia: (input: {
    externalMessageId: string
    senderAddress: string
  }) => Promise<DownloadedMedia>
  logout: () => Promise<void>
  end: (error: Error | undefined) => Promise<void>
}

export interface SessionEvents {
  "connection.update"?: {
    connection?: "open" | "connecting" | "close"
    qr?: string
    lastDisconnect?: { error?: unknown }
  }
  "creds.update"?: unknown
  "messages.upsert"?: { type: string; messages: RawInboundMessage[] }
  "messages.update"?: Array<{
    key: { id?: string | null; fromMe?: boolean | null }
    update?: { status?: number | null }
  }>
}
