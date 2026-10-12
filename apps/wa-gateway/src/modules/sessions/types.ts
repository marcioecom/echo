import type { RawInboundMessage } from "./inbound-filter"

export interface ConnectionRef {
  organizationId: string
  channelConnectionId: string
}

export interface SessionLogger {
  info: (message: string, data?: Record<string, unknown>) => void
  warn: (message: string, data?: Record<string, unknown>) => void
  error: (message: string, data?: Record<string, unknown>) => void
}

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
