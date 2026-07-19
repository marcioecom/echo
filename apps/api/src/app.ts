import Fastify from "fastify"

import type { ApiEnv } from "./config/env"
import {
  registerHealthRoutes,
  type HealthDependencies,
} from "./plugins/health"

export function createApp(env: ApiEnv, dependencies: HealthDependencies) {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      base: {
        service: "api",
        environment: env.NODE_ENV,
      },
      transport:
        env.NODE_ENV === "development"
          ? { target: "pino-pretty", options: { colorize: true } }
          : undefined,
    },
  })

  registerHealthRoutes(app, dependencies)

  return app
}
