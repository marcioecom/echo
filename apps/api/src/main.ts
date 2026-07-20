import { createDatabase } from "@workspace/db"
import { pino } from "pino"

import { createApp } from "./app"
import { loadApiEnv } from "./config/env"
import { createRedis } from "./lib/redis"
import { createAuth } from "./modules/auth/auth"
import { createEmailQueue } from "./modules/notifications/email-queue"

async function main(): Promise<void> {
  const env = loadApiEnv()
  const database = createDatabase(env.DATABASE_URL, env.DEPENDENCY_TIMEOUT_MS)
  const redis = createRedis(
    env.REDIS_URL,
    env.DEPENDENCY_TIMEOUT_MS,
  )
  const emailQueue = createEmailQueue(redis)
  const authLogger = pino({
    level: env.LOG_LEVEL,
    base: { service: "api", component: "auth" },
  })
  const auth = createAuth({
    db: database.db,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    webAppUrl: env.WEB_APP_URL,
    deliverInvitationEmail: (request) =>
      emailQueue.enqueueSendInvitationEmail(request),
    onDeliveryError: (error, request) => {
      authLogger.error(
        { err: error, invitationId: request.invitationId },
        "failed to enqueue invitation email",
      )
    },
  })
  const app = createApp(env, {
    postgres: () => database.check(),
    redis: async () => {
      await redis.ping()
    },
    auth,
  })

  let shuttingDown = false

  async function runShutdownStep(
    failures: Array<{ step: string; error: unknown }>,
    step: string,
    action: () => Promise<unknown>,
  ): Promise<void> {
    try {
      await action()
    } catch (error) {
      failures.push({ step, error })
    }
  }

  async function shutdown(signal?: NodeJS.Signals): Promise<void> {
    if (shuttingDown) return
    shuttingDown = true

    if (signal) {
      app.log.info({ signal }, "shutting down")
    }

    const failures: Array<{ step: string; error: unknown }> = []

    await runShutdownStep(failures, "app.close", () => app.close())
    await runShutdownStep(failures, "emailQueue.close", () => emailQueue.close())
    await runShutdownStep(failures, "redis.quit", () =>
      redis.quit(),
    )
    await runShutdownStep(failures, "database.close", () => database.close())

    if (failures.length > 0) {
      app.log.error({ failures }, "shutdown failed")
      process.exitCode = 1
    }
  }

  try {
    await database.check()
    await redis.ping()

    process.once("SIGINT", () => void shutdown("SIGINT"))
    process.once("SIGTERM", () => void shutdown("SIGTERM"))

    await app.listen({ host: env.API_HOST, port: env.API_PORT })
  } catch (error) {
    await shutdown()
    throw error
  }
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
