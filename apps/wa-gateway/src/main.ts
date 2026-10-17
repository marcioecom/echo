import { hostname } from "node:os"

import { createLoggerWithContext } from "@workspace/logger"

import { createApp } from "./app"
import { env } from "./config/env"
import { database } from "./lib/db"
import { jobs } from "./lib/jobs"
import { pingRedis, redisConnection } from "./lib/redis"
import { SessionRegistry } from "./modules/sessions/ownership/registry"
import { PostgresAuthKeysRepository } from "./modules/sessions/repositories/postgres-auth-keys-repository"
import { PostgresSessionDirectory } from "./modules/sessions/repositories/session-directory"
import { openSession } from "./modules/sessions/use-cases/open-session"
import { startGatewayWorker } from "./modules/sessions/workers/gateway-worker"

const logger = createLoggerWithContext("wa-gateway:main")

async function main(): Promise<void> {
  const directory = new PostgresSessionDirectory()
  const authKeys = new PostgresAuthKeysRepository()
  const ownerPod = env.POD_NAME ?? hostname()
  const registry = new SessionRegistry({
    redis: redisConnection,
    directory,
    ownerPod,
    openSession: (connection, lease) =>
      openSession(connection, lease, { authKeys, directory, ownerPod }),
  })

  const app = createApp()
  let shutdownPromise: Promise<void> | undefined
  let closeWorker: () => Promise<void> = async () => undefined

  function shutdown(signal?: NodeJS.Signals): Promise<void> {
    shutdownPromise ??= performShutdown(signal)
    return shutdownPromise
  }

  async function performShutdown(signal?: NodeJS.Signals): Promise<void> {
    if (signal) logger.info("shutting down", { signal })

    const steps: ReadonlyArray<readonly [string, () => Promise<unknown>]> = [
      ["gateway.stop", () => registry.stop()],
      ["worker.close", () => closeWorker()],
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
      logger.error("shutdown failed", { failures })
      process.exitCode = 1
    }
  }

  process.once("SIGINT", () => {
    shutdown("SIGINT")
  })
  process.once("SIGTERM", () => {
    shutdown("SIGTERM")
  })

  await database.check()
  await pingRedis()
  await registry.start()
  const worker = startGatewayWorker(registry)
  closeWorker = () => worker.close()
  await app.listen({ host: env.WA_GATEWAY_HOST, port: env.WA_GATEWAY_PORT })
  logger.info("wa-gateway listening", { port: env.WA_GATEWAY_PORT })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
