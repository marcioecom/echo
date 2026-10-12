import { publishInboxEvent } from "@workspace/jobs"

import { redisConnection } from "@/lib/redis"

export function publishChannelStatusChanged(input: {
  organizationId: string
  channelConnectionId: string
}): Promise<void> {
  return publishInboxEvent(redisConnection, input.organizationId, {
    type: "channel.status_changed",
    channelConnectionId: input.channelConnectionId,
  })
}
