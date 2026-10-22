import type {
  AnalyticsEventName,
  AnalyticsEventProperties,
} from "@workspace/analytics"
import type { PostHog } from "posthog-js"

import {
  analyticsEventOwners,
  analyticsGroupType,
  assertSafeAnalyticsProperties,
} from "@workspace/analytics"

const posthogApiHost =
  import.meta.env.VITE_POSTHOG_HOST ?? "https://us.i.posthog.com"

const posthogUiHost = "https://us.posthog.com"

let clientPromise: Promise<PostHog | null> | null = null
let lastPageviewPath: string | null = null

export function isAnalyticsEnabled() {
  return (
    !import.meta.env.SSR &&
    typeof window !== "undefined" &&
    Boolean(import.meta.env.VITE_POSTHOG_KEY)
  )
}

function initAnalytics(): Promise<PostHog | null> {
  if (import.meta.env.SSR) return Promise.resolve(null)
  if (!isAnalyticsEnabled()) return Promise.resolve(null)
  if (clientPromise) return clientPromise

  const key = import.meta.env.VITE_POSTHOG_KEY
  if (!key) return Promise.resolve(null)

  clientPromise = import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.init(key, {
        api_host: posthogApiHost,
        ui_host: posthogUiHost,
        person_profiles: "identified_only",
        capture_pageview: false,
        autocapture: true,
        session_recording: {
          maskAllInputs: true,
        },
      })
      return posthog
    })
    .catch((error: unknown) => {
      clientPromise = null
      if (import.meta.env.DEV) {
        console.warn("[analytics] PostHog failed to initialize", error)
      }
      return null
    })

  return clientPromise
}

export async function track<Event extends AnalyticsEventName>(
  event: Event,
  properties: AnalyticsEventProperties[Event]
): Promise<void> {
  const owner = analyticsEventOwners[event]

  if (owner !== "web") {
    const message = `[analytics] "${event}" is owned by "${owner}" and must not be captured from apps/web.`
    if (import.meta.env.DEV) throw new Error(message)
    console.warn(message)
    return
  }

  if (!isAnalyticsEnabled()) return

  if (import.meta.env.DEV) {
    assertSafeAnalyticsProperties(properties)
  }

  const posthog = await initAnalytics()
  posthog?.capture(event, properties)
}

export async function identifyUser(userId: string): Promise<void> {
  const posthog = await initAnalytics()
  posthog?.identify(userId)
}

export async function groupOrganization(
  organizationId: string,
  properties: { name?: string } = {}
): Promise<void> {
  const posthog = await initAnalytics()
  posthog?.group(
    analyticsGroupType,
    organizationId,
    properties.name ? { name: properties.name } : undefined
  )
}

export async function capturePageview(pathname: string): Promise<void> {
  if (!isAnalyticsEnabled()) return
  if (lastPageviewPath === pathname) return
  lastPageviewPath = pathname

  const posthog = await initAnalytics()
  posthog?.capture("$pageview")
}

export async function resetAnalytics(): Promise<void> {
  const posthog = await initAnalytics()
  if (!posthog) return

  posthog.reset()
  lastPageviewPath = null
}
