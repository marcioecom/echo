import { createDatabase } from "@workspace/db"

import { createApp } from "./app"
import { loadApiEnv } from "./config/env"
import { createRedis } from "./lib/redis"

const env = loadApiEnv()
const database = createDatabase(env.DATABASE_URL, env.DEPENDENCY_TIMEOUT_MS)
const redis = createRedis(env.REDIS_URL, env.DEPENDENCY_TIMEOUT_MS)

try {
  await database.check()
  await redis.connect()
  await redis.ping()
} catch (error) {
  await Promise.allSettled([database.close(), redis.quit()])
  throw error
}

const app = createApp(env, {
  postgres: () => database.check(),
  redis: async () => {
    await redis.ping()
  },
})

let shuttingDown = false

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true

  app.log.info({ signal }, "shutting down")
  const results = await Promise.allSettled([
    app.close(),
    redis.quit(),
    database.close(),
  ])

  if (results.some((result) => result.status === "rejected")) {
    app.log.error({ results }, "shutdown failed")
    process.exitCode = 1
  }
}

process.once("SIGINT", () => void shutdown("SIGINT"))
process.once("SIGTERM", () => void shutdown("SIGTERM"))

await app.listen({ host: env.API_HOST, port: env.API_PORT })
