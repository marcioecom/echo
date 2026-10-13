import { waGatewayQueueName } from "@workspace/jobs"
import { createLoggerWithContext } from "@workspace/logger"
import { Worker } from "bullmq"

import { redisConnection } from "@/lib/redis"

import type { SessionManager } from "../session-manager"
import { handleWaGatewayJob } from "../use-cases/handle-gateway-job"

const logger = createLoggerWithContext("wa-gateway:worker")

export function startGatewayWorker(manager: SessionManager): {
  close: () => Promise<void>
} {
  const worker = new Worker(
    waGatewayQueueName,
    (job) => handleWaGatewayJob(manager, job),
    { connection: redisConnection, concurrency: 8 }
  )
  worker.on("failed", (job, error) => {
    logger.error("wa-gateway job failed", {
      error: error.message,
      jobName: job?.name,
      jobId: job?.id,
      organizationId: job?.data?.organizationId,
      channelConnectionId: job?.data?.channelConnectionId,
    })
  })

  return {
    close: () => worker.close(),
  }
}
