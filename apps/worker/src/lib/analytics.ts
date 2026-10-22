import { createServerAnalytics } from "@workspace/analytics"
import { createLoggerWithContext } from "@workspace/logger"
import { PostHog } from "posthog-node"

import { env } from "../config/env"

const logger = createLoggerWithContext("worker:analytics")

const client = env.POSTHOG_API_KEY
  ? new PostHog(env.POSTHOG_API_KEY, {
      host: env.POSTHOG_HOST,
      flushAt: 20,
      flushInterval: 10_000,
    })
  : null

if (!client) {
  logger.info("Product analytics disabled: POSTHOG_API_KEY is not configured")
}

export const { capture, shutdown: shutdownAnalytics } = createServerAnalytics({
  owner: "worker",
  client,
  isDevelopment: env.NODE_ENV === "development",
  logger,
})
