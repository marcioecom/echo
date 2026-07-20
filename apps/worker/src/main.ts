import { createDatabase } from "@workspace/db"

import { createApp } from "./app"
import { loadWorkerEnv } from "./config/env"
import {
  createRedis,
  createWorkerRedisConnection,
} from "./lib/redis"
import { createEmailWorker } from "./modules/notifications/email-worker"

async function main(): Promise<void> {
  const env = loadWorkerEnv()
  const database = createDatabase(env.DATABASE_URL, env.DEPENDENCY_TIMEOUT_MS)
  const redis = createRedis(
    env.REDIS_URL,
    env.DEPENDENCY_TIMEOUT_MS,
  )
  const workerRedisConnection = createWorkerRedisConnection(env.REDIS_URL)
  const workers = [
    createEmailWorker({
      connection: workerRedisConnection,
      resendApiKey: env.RESEND_API_KEY,
      emailFrom: env.EMAIL_FROM,
    }),
  ]
  const app = createApp(env, {
    postgres: () => database.check(),
    redis: async () => {
      await redis.ping()
    },
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

  async function closeWorkersWithin(timeoutMs: number): Promise<void> {
    let timeout: NodeJS.Timeout | undefined

    try {
      await Promise.race([
        Promise.all(workers.map((worker) => worker.close())).then(() => undefined),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            reject(
              new Error(`worker shutdown timed out after ${timeoutMs}ms`),
            )
          }, timeoutMs)
          timeout.unref?.()
        }),
      ])
    } finally {
      if (timeout) {
        clearTimeout(timeout)
      }
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
    await runShutdownStep(failures, "workers.close", () =>
      closeWorkersWithin(env.DEPENDENCY_TIMEOUT_MS),
    )
    await runShutdownStep(failures, "workerRedisConnection.quit", () =>
      workerRedisConnection.quit(),
    )
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
    await redis.connect()
    await redis.ping()

    process.once("SIGINT", () => void shutdown("SIGINT"))
    process.once("SIGTERM", () => void shutdown("SIGTERM"))

    await app.listen({ host: env.WORKER_HOST, port: env.WORKER_PORT })
  } catch (error) {
    await shutdown()
    throw error
  }
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
