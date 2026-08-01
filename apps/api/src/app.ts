import cors from "@fastify/cors"
import formbody from "@fastify/formbody"
import Fastify, { type FastifyBaseLogger } from "fastify"

import { createLoggerWithContext } from "@workspace/logger"
import { env } from "./config/env"
import { auth } from "./modules/auth/auth"
import { registerInboundMessageRoutes } from "./modules/inbound-messages/http/routes"
import { registerAuthRoutes } from "./plugins/auth"
import { registerHealthRoutes } from "./plugins/health"

export function createApp() {
  const logger: FastifyBaseLogger = createLoggerWithContext("api")
  const app = Fastify({ loggerInstance: logger })

  app.register(formbody)
  app.register(cors, {
    origin: env.WEB_APP_URL,
    credentials: true,
  })
  app.setErrorHandler((error, request, reply) => {
    request.log.error({ error }, "Unhandled API error")
    return reply.code(503).send({ error: "webhook_processing_unavailable" })
  })

  registerHealthRoutes(app)
  registerAuthRoutes(app, auth)
  registerInboundMessageRoutes(app)

  return app
}
