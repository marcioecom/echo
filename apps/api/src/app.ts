import cors from "@fastify/cors"
import formbody from "@fastify/formbody"
import rateLimit from "@fastify/rate-limit"
import websocket from "@fastify/websocket"
import { createLoggerWithContext } from "@workspace/logger"
import Fastify, { type FastifyBaseLogger } from "fastify"

import { env } from "./config/env"
import { auth } from "./modules/auth/auth"
import { registerInboundMessageRoutes } from "./modules/channel-messaging/http/routes"
import { registerSupportInboxRoutes } from "./modules/support-inbox/http/routes"
import { registerAuthRoutes } from "./plugins/auth"
import { registerHealthRoutes } from "./plugins/health"

export function createApp() {
  const logger: FastifyBaseLogger = createLoggerWithContext("api")
  const app = Fastify({ loggerInstance: logger })

  app.register(formbody)
  app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute",
  })
  app.register(websocket)
  app.register(cors, {
    origin: env.WEB_APP_URL,
    credentials: true,
  })

  app.register(async (routes) => {
    registerHealthRoutes(routes)
    registerAuthRoutes(routes, auth)
    registerInboundMessageRoutes(routes)
    registerSupportInboxRoutes(routes)
  })

  return app
}
