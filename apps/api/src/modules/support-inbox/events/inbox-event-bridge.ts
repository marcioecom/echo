import {
  inboxEventChannelPattern,
  parseInboxEvent,
} from "@workspace/jobs"
import { Redis } from "ioredis"

import { env } from "@/config/env"
import { supportInboxEventBroker } from "./support-inbox-event-broker"

export function createInboxEventBridge(): Redis {
  const subscriber = new Redis(env.REDIS_URL, {
    commandTimeout: env.DEPENDENCY_TIMEOUT_MS,
    connectTimeout: env.DEPENDENCY_TIMEOUT_MS,
    lazyConnect: true,
    maxRetriesPerRequest: null,
  })
  subscriber.on("pmessage", (_pattern, channel, raw) => {
    const parsed = parseInboxEvent(channel, raw)
    if (!parsed) return
    supportInboxEventBroker.publish(parsed.organizationId, parsed.event)
  })
  return subscriber
}

// TODO: add subscribe when create inbox event bridge
export async function startInboxEventBridge(
  subscriber: Redis
): Promise<void> {
  await subscriber.psubscribe(inboxEventChannelPattern)
}
