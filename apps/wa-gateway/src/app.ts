import { createLoggerWithContext } from "@workspace/logger"
import Fastify, { type FastifyBaseLogger } from "fastify"

import { registerHealthRoutes } from "./plugins/health"

export function createApp() {
  const logger: FastifyBaseLogger = createLoggerWithContext("wa-gateway")
  const app = Fastify({ loggerInstance: logger })
  registerHealthRoutes(app)
  return app
}
