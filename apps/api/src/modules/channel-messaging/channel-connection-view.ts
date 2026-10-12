import type { ListedChannelConnection } from "./repositories/channel-connections-repository"
import { twilioInboundWebhookUrl } from "./twilio-inbound-webhook-url"

export interface ChannelConnectionView {
  id: string
  channelType: ListedChannelConnection["channelType"]
  provider: ListedChannelConnection["provider"]
  name: string
  displayName: string | null
  address: string | null
  status: ListedChannelConnection["status"]
  inboxId: string | null
  webhookUrl: string | null
  session: {
    state: NonNullable<ListedChannelConnection["session"]>["state"]
    lastError: string | null
    lastConnectedAt: string | null
    lastSeenAt: string | null
  } | null
  updatedAt: string
}

export function toChannelConnectionView(
  connection: ListedChannelConnection
): ChannelConnectionView {
  return {
    id: connection.id,
    channelType: connection.channelType,
    provider: connection.provider,
    name: connection.name,
    displayName: connection.displayName,
    address: connection.address,
    status: connection.status,
    inboxId: connection.inboxId,
    webhookUrl:
      connection.provider === "twilio" ? twilioInboundWebhookUrl() : null,
    session: connection.session
      ? {
          state: connection.session.state,
          lastError: connection.session.lastError,
          lastConnectedAt:
            connection.session.lastConnectedAt?.toISOString() ?? null,
          lastSeenAt: connection.session.lastSeenAt?.toISOString() ?? null,
        }
      : null,
    updatedAt: connection.updatedAt.toISOString(),
  }
}
