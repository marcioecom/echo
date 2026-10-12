import cors from "@fastify/cors"
import formbody from "@fastify/formbody"
import rateLimit from "@fastify/rate-limit"
import websocket from "@fastify/websocket"
import { createLoggerWithContext } from "@workspace/logger"
import Fastify, { LogController } from "fastify"
import type { FastifyBaseLogger } from "fastify"

import { env } from "./config/env"
import { auth } from "./modules/auth/auth"
import { registerChannelRoutes } from "./modules/channel-messaging/http/channel-routes"
import { registerInboundMessageRoutes } from "./modules/channel-messaging/http/routes"
import { registerKnowledgeBaseRoutes } from "./modules/knowledge-base/http/routes"
import { registerSupportInboxRoutes } from "./modules/support-inbox/http/routes"
import { registerAuthRoutes } from "./plugins/auth"
import { registerHealthRoutes } from "./plugins/health"
import { registerRequestLogging } from "./plugins/request-logging"

export function createApp() {
  const logger: FastifyBaseLogger = createLoggerWithContext("api")
  const app = Fastify({
    loggerInstance: logger,
    logController: new LogController({ disableRequestLogging: true }),
  })
  registerRequestLogging(app, env.NODE_ENV === "development")

  app.register(formbody)
  app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute",
  })
  app.register(websocket)
  app.register(cors, {
    origin: env.WEB_APP_URL,
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PATCH", "DELETE"],
  })

  app.register(async (routes) => {
    registerHealthRoutes(routes)
    registerAuthRoutes(routes, auth)
    registerInboundMessageRoutes(routes)
    registerChannelRoutes(routes)
    registerSupportInboxRoutes(routes)
    registerKnowledgeBaseRoutes(routes)
  })

  return app
}
