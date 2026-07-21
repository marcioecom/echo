import cors from "@fastify/cors"
import Fastify from "fastify"

import type { ApiEnv } from "./config/env"
import type { Auth } from "./modules/auth/auth"
import { registerAuthRoutes } from "./plugins/auth"
import {
  registerHealthRoutes,
  type HealthDependencies,
} from "./plugins/health"

export interface AppDependencies extends HealthDependencies {
  auth?: Auth
}

export function createApp(env: ApiEnv, dependencies: AppDependencies) {
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

  if (dependencies.auth) {
    void app.register(cors, {
      origin: env.WEB_APP_URL,
      credentials: true,
    })
    registerAuthRoutes(app, dependencies.auth)
  }

  return app
}
