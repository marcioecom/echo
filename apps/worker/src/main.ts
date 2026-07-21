import { workbench } from "@getworkbench/fastify"
import { createLoggerWithContext } from "@workspace/logger"
import { Worker } from "bullmq"
import { createApp } from "./app"
import { env } from "./config/env"
import { db } from "./lib/db"
import { redisConnection, workerRedisConnection } from "./lib/redis"
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
  })

  const app = createApp()

  await app.register(workbench({ queues: getAllQueues() }))

  let shuttingDown = false

  async function runShutdownStep(
    failures: Array<{ step: string; error: unknown }>,
    step: string,
    action: () => Promise<unknown>
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
        Promise.all(workers.map((worker) => worker.close())).then(
          () => undefined
        ),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            reject(new Error(`worker shutdown timed out after ${timeoutMs}ms`))
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
      closeWorkersWithin(env.DEPENDENCY_TIMEOUT_MS)
    )
    await runShutdownStep(failures, "workerRedisConnection.quit", () =>
      workerRedisConnection.quit()
    )
    await runShutdownStep(failures, "redis.quit", () => redisConnection.quit())
    await runShutdownStep(failures, "database.close", () => db.close())

    if (failures.length > 0) {
      app.log.error({ failures }, "shutdown failed")
      process.exitCode = 1
    }
  }

  try {
    await db.check()
    await redisConnection.ping()

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
