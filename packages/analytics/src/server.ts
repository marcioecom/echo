import type {
  AnalyticsEventName,
  AnalyticsEventProperties,
  AnalyticsOwner,
} from "./events"

import {
  analyticsEventOwners,
  analyticsGroupType,
  assertSafeAnalyticsProperties,
  organizationDistinctId,
} from "./events"

type ServerAnalyticsOwner = Exclude<AnalyticsOwner, "web">

type CaptureInput<E extends AnalyticsEventName> = {
  distinctId?: string
  properties: Omit<AnalyticsEventProperties[E], "organizationId">
} & (AnalyticsEventProperties[E] extends { organizationId: string }
  ? { organizationId: string }
  : { organizationId?: undefined })

type ServerAnalyticsClient = {
  capture(event: {
    event: string
    distinctId: string
    properties: Record<string, unknown>
    groups?: Record<string, string>
  }): void
  shutdown(): Promise<void>
}

type ServerAnalyticsLogger = {
  warn(message: string, data?: object): void
  error(message: string, data?: object): void
}

export function createServerAnalytics(input: {
  owner: ServerAnalyticsOwner
  client: ServerAnalyticsClient | null
  isDevelopment: boolean
  logger: ServerAnalyticsLogger
}) {
  const { owner, client, isDevelopment, logger } = input

  function reportMisuse(message: string): void {
    if (isDevelopment) throw new Error(message)
    logger.warn(message)
  }

  function capture<E extends AnalyticsEventName>(
    event: E,
    input: CaptureInput<E>
  ): void {
    const eventOwner = analyticsEventOwners[event]
    if (eventOwner !== owner) {
      reportMisuse(`Analytics event "${event}" is owned by "${eventOwner}"`)
      return
    }

    const organizationId =
      "organizationId" in input ? input.organizationId : undefined
    const properties = {
      ...input.properties,
      ...(organizationId === undefined ? {} : { organizationId }),
    } as AnalyticsEventProperties[E]

    try {
      assertSafeAnalyticsProperties(properties)
    } catch (error) {
      if (isDevelopment) throw error
      logger.error("Analytics event dropped: unsafe properties", {
        error,
        event,
        organizationId,
      })
      return
    }

    if (!client) return

    const distinctId =
      input.distinctId ??
      (organizationId === undefined
        ? undefined
        : organizationDistinctId(organizationId))
    if (!distinctId) {
      reportMisuse(
        `Analytics event "${event}" needs a distinctId when it has no organization`
      )
      return
    }

    try {
      client.capture({
        event,
        distinctId,
        properties,
        ...(organizationId === undefined
          ? {}
          : { groups: { [analyticsGroupType]: organizationId } }),
      })
    } catch (error) {
      logger.error("Analytics capture failed", {
        error,
        event,
        organizationId,
      })
    }
  }

  async function shutdown(): Promise<void> {
    if (!client) return

    try {
      await client.shutdown()
    } catch (error) {
      logger.error("Analytics shutdown failed", { error })
    }
  }

  return { capture, shutdown }
}
