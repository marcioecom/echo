import type {
  ChannelConnectionStatus,
  ChannelProvider,
  ChannelSessionState,
  ChannelType,
} from "@workspace/domain"
import { z } from "zod"

export interface ChannelConnection {
  id: string
  channelType: ChannelType
  provider: ChannelProvider
  name: string
  displayName: string | null
  address: string | null
  status: ChannelConnectionStatus
  inboxId: string | null
  webhookUrl: string | null
  session: {
    state: ChannelSessionState
    lastError: string | null
    lastConnectedAt: string | null
    lastSeenAt: string | null
  } | null
  updatedAt: string
}

export const channelStatusChangedEventSchema = z.object({
  type: z.literal("channel.status_changed"),
  channelConnectionId: z.string(),
})

export const channelQrEventSchema = z.object({
  type: z.literal("channel.qr"),
  channelConnectionId: z.string(),
  qr: z.string().min(1),
})

export const channelPairingCodeEventSchema = z.object({
  type: z.literal("channel.pairing_code"),
  channelConnectionId: z.string(),
  pairingCode: z.string().min(1),
})
