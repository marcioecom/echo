import { publishInboxEvent } from "@workspace/jobs"

import { redisConnection } from "@/lib/redis"

import type { ConnectionRef } from "../types"

export function publishChannelQr(
  input: ConnectionRef & { qr: string }
): Promise<void> {
  return publishInboxEvent(redisConnection, input.organizationId, {
    type: "channel.qr",
    channelConnectionId: input.channelConnectionId,
    qr: input.qr,
  })
}

export function publishPairingCode(
  input: ConnectionRef & { pairingCode: string }
): Promise<void> {
  return publishInboxEvent(redisConnection, input.organizationId, {
    type: "channel.pairing_code",
    channelConnectionId: input.channelConnectionId,
    pairingCode: input.pairingCode,
  })
}

export function publishChannelStatus(input: ConnectionRef): Promise<void> {
  return publishInboxEvent(redisConnection, input.organizationId, {
    type: "channel.status_changed",
    channelConnectionId: input.channelConnectionId,
  })
}
