import { QueryClient } from "@tanstack/react-query"
import { createRouter } from "@tanstack/react-router"
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query"
import * as Sentry from "@sentry/tanstackstart-react"

import { routeTree } from "./routeTree.gen"

export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
      },
    },
  })

  const router = createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
  })

  setupRouterSsrQueryIntegration({ router, queryClient })

  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!router.isServer && dsn) {
    Sentry.init({
      dsn,
      integrations: [
        Sentry.tanstackRouterBrowserTracingIntegration(router),
        Sentry.replayIntegration(),
      ],
      tracesSampleRate: 0.2,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
    })
  }

  return router
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
