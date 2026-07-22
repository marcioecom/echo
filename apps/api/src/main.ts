import { createLoggerWithContext } from "@workspace/logger"
import { createApp } from "./app"
import { env } from "./config/env"
import { database } from "./lib/db"
import { redisConnection } from "./lib/redis"
import { jobs } from "./lib/jobs-client"

const logger = createLoggerWithContext("api:main")

async function main(): Promise<void> {
  const app = createApp()

  async function shutdown(signal?: NodeJS.Signals): Promise<void> {
    if (signal) {
      logger.info({ signal }, "shutting down")
    }

    const steps: ReadonlyArray<readonly [string, () => Promise<unknown>]> = [
      ["app.close", () => app.close()],
      ["jobs.close", () => jobs.close()],
      ["redis.quit", () => redisConnection.quit()],
      ["database.close", () => database.close()],
    ]

    const failures: Array<{ step: string; error: unknown }> = []

    for (const [step, close] of steps) {
      try {
        await close()
      } catch (error) {
        failures.push({ step, error })
        logger.error("shutdown step failed", { error, step })
      }
    }

    if (failures.length > 0) {
      logger.error({ failures }, "shutdown failed")
      process.exitCode = 1
    }
  }

  process.once("SIGINT", () => shutdown("SIGINT"))
  process.once("SIGTERM", () => shutdown("SIGTERM"))

  await app.listen({ host: env.API_HOST, port: env.API_PORT })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
