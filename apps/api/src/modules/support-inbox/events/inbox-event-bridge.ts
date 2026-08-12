import {
  inboxEventChannelPattern,
  parseInboxEvent,
} from "@workspace/jobs"
import { Redis } from "ioredis"

import { env } from "@/config/env"
import { supportInboxEventBroker } from "./support-inbox-event-broker"

export async function startInboxEventBridge(): Promise<Redis> {
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
  await subscriber.psubscribe(inboxEventChannelPattern)
  return subscriber
}
