import type {
  ChannelProvider,
  ChannelSessionState,
  MessageStatus,
  NormalizedInboundMessage,
} from "@workspace/domain"

export type ChannelDelivery = "webhook" | "session"

export type OutboundContent =
  | { type: "text"; body: string }
  | {
      type: "media"
      kind: "image" | "audio" | "video" | "document"
      url: string
      caption?: string
      fileName?: string
    }

export type SendResult =
  | { ok: true; externalMessageId: string }
  | {
      ok: false
      retryable: boolean
      code: string
      message?: string
      providerCode?: number
    }

export interface ConnectionContext {
  organizationId: string
  channelConnectionId: string
  fromAddress: string
  externalAccountId: string | null
  authToken: string
  outboundMessageId?: string
}

export interface ConnectionHealth {
  state: ChannelSessionState
  reason?: string
}

export type DeliveryStatus = Extract<
  MessageStatus,
  "pending" | "sent" | "delivered" | "read" | "failed"
>

export interface StatusUpdate {
  organizationId: string
  channelConnectionId: string
  externalMessageId: string
  status: DeliveryStatus
}

export interface InboundParseInput {
  organizationId: string
  channelConnectionId: string
  receivedAt: Date
  payload: unknown
}

export type InboundParseResult =
  | { ok: true; message: NormalizedInboundMessage }
  | { ok: true; status: StatusUpdate }
  | { ok: false; reason: "malformed_event" | "ignored" }

export interface MediaRef {
  externalMessageId: string
  url?: string
}

export interface ChannelAdapter {
  readonly provider: ChannelProvider
  readonly delivery: ChannelDelivery

  send(
    ctx: ConnectionContext,
    to: string,
    content: OutboundContent
  ): Promise<SendResult>

  health(ctx: ConnectionContext): Promise<ConnectionHealth>

  parseInbound?(
    input: InboundParseInput,
    ctx: ConnectionContext
  ): Promise<InboundParseResult>

  fetchMedia?(
    ctx: ConnectionContext,
    ref: MediaRef
  ): Promise<{ stream: ReadableStream; mime: string }>

  markRead?(ctx: ConnectionContext, externalMessageId: string): Promise<void>
}
