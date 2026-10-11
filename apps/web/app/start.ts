import {
  sentryGlobalFunctionMiddleware,
  sentryGlobalRequestMiddleware,
} from "@sentry/tanstackstart-react"
import { redirect } from "@tanstack/react-router"
import { createMiddleware, createStart } from "@tanstack/react-start"

import { negotiateLandingRootRedirect } from "@/modules/marketing/i18n/negotiation"

const landingLocaleMiddleware = createMiddleware().server(
  async ({ next, request, pathname, handlerType }) => {
    if (handlerType === "router") {
      const location = negotiateLandingRootRedirect({
        pathname,
        search: new URL(request.url).search,
        cookieHeader: request.headers.get("cookie"),
        acceptLanguage: request.headers.get("accept-language"),
      })

      if (location) {
        throw redirect({
          href: location,
          statusCode: 302,
          headers: {
            Vary: "Accept-Language",
            "Cache-Control": "private, no-store",
          },
        })
      }
    }

    return next()
  }
)

export const startInstance = createStart(() => ({
  requestMiddleware: [sentryGlobalRequestMiddleware, landingLocaleMiddleware],
  functionMiddleware: [sentryGlobalFunctionMiddleware],
}))

