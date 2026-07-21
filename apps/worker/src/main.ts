import { workbench } from "@getworkbench/fastify"
import { createLoggerWithContext } from "@workspace/logger"
import { Worker } from "bullmq"
import { createApp } from "./app"
import { env } from "./config/env"
import { db } from "./lib/db"
import { pingRedis, redisConnection } from "./lib/redis"
import { getProcessor } from "./processors/registry"
import { getAllQueues, queuesConfigs } from "./queues"

const logger = createLoggerWithContext("worker")

async function main(): Promise<void> {
  const workers = queuesConfigs.map((config) => {
    const worker = new Worker(
      config.name,
      async (job) => {
        const processor = getProcessor(job.name)
        if (!processor)
          throw new Error(`No processor registered for job: ${job.name}`)
        return processor(job)
      },
      config.workerOptions
    )

    worker.on("error", (error: Error) => {
      logger.error(`Worker error: ${config.name}`, {
        error: error.message,
      })
    })
    worker.on("failed", (job, error) => {
      logger.error(`Job failed: ${job?.name}`, {
        worker: config.name,
        jobId: job?.id,
        error: error.message,
      })
      if (config.eventHandlers?.onFailed)
        config.eventHandlers?.onFailed(job, error)
    })
    worker.on("completed", (job) => {
      if (config.eventHandlers?.onCompleted)
        config.eventHandlers?.onCompleted(job)
    })
    return worker
  })

  const app = createApp()

  await app.register(workbench({ queues: getAllQueues() }))

  let shutdownPromise: Promise<void> | undefined

  function shutdown(signal?: NodeJS.Signals): Promise<void> {
    shutdownPromise ??= performShutdown(signal)
    return shutdownPromise
  }

  async function performShutdown(signal?: NodeJS.Signals): Promise<void> {
    if (signal) {
      app.log.info({ signal }, "shutting down")
    }

    const deadline = setTimeout(() => {
      app.log.error(
        { timeoutMs: env.DEPENDENCY_TIMEOUT_MS },
        "shutdown timed out"
      )
      process.exit(1)
    }, env.DEPENDENCY_TIMEOUT_MS)
    deadline.unref?.()

    const steps: ReadonlyArray<readonly [string, () => Promise<unknown>]> = [
      ["app.close", () => app.close()],
      ["workers.close", () => Promise.all(workers.map((w) => w.close()))],
      ["redis.quit", () => redisConnection.quit()],
      ["database.close", () => db.close()],
    ]

    let failed = false

    try {
      for (const [step, close] of steps) {
        try {
          await close()
        } catch (error) {
          failed = true
          app.log.error({ err: error, step }, "shutdown step failed")
        }
      }
    } finally {
      clearTimeout(deadline)
    }

    if (failed) process.exitCode = 1
  }

  try {
    await db.check()
    await pingRedis()

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
