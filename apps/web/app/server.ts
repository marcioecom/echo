import * as Sentry from "@sentry/cloudflare"
import { wrapFetchWithSentry } from "@sentry/tanstackstart-react"
import handler from "@tanstack/react-start/server-entry"

export default Sentry.withSentry(
  () => ({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    tracesSampleRate: 0.2,
  }),
  wrapFetchWithSentry(handler)
)
