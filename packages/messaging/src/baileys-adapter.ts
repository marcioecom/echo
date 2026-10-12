import type {
  ChannelAdapter,
  ConnectionContext,
  ConnectionHealth,
  OutboundContent,
  SendResult,
} from "./channel-adapter"

export interface BaileysOutboundCommand {
  organizationId: string
  channelConnectionId: string
  outboundMessageId: string
  to: string
  body: string
}

export interface BaileysSendTransport {
  send(command: BaileysOutboundCommand): Promise<SendResult>
}

export class BaileysAdapter implements ChannelAdapter {
  readonly provider = "baileys" as const
  readonly delivery = "session" as const

  constructor(private readonly transport: BaileysSendTransport) {}

  async send(
    ctx: ConnectionContext,
    to: string,
    content: OutboundContent
  ): Promise<SendResult> {
    if (content.type !== "text") {
      return { ok: false, retryable: false, code: "unsupported_content" }
    }
    if (!ctx.outboundMessageId) {
      return { ok: false, retryable: false, code: "missing_message" }
    }

    return this.transport.send({
      organizationId: ctx.organizationId,
      channelConnectionId: ctx.channelConnectionId,
      outboundMessageId: ctx.outboundMessageId,
      to,
      body: content.body,
    })
  }

  async health(): Promise<ConnectionHealth> {
    return { state: "disconnected" }
  }
}
