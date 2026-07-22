import cors from "@fastify/cors"
import Fastify, { type FastifyBaseLogger } from "fastify"

import { createLoggerWithContext } from "@workspace/logger"
import { env } from "./config/env"
import { auth } from "./modules/auth/auth"
import { registerAuthRoutes } from "./plugins/auth"
import { registerHealthRoutes } from "./plugins/health"

export function createApp() {
  const logger: FastifyBaseLogger = createLoggerWithContext("api")
  const app = Fastify({ loggerInstance: logger })

  app.register(cors, {
    origin: env.WEB_APP_URL,
    credentials: true,
  })

  registerHealthRoutes(app)
  registerAuthRoutes(app, auth)

  return app
}
