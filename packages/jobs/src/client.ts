import type { JobsOptions } from "bullmq"
import { Queue } from "bullmq"
import type { Redis } from "ioredis"
import type { z } from "zod"
import { queueDefinitions, waGatewayQueueDefinition } from "./queue-definitions"
import { jobDefinitions, type JobName } from "./schemas"

export interface EnqueuedJob {
  id: string
}

export interface JobClient {
  enqueue: <TJobName extends JobName>(
    jobName: TJobName,
    payload: z.input<(typeof jobDefinitions)[TJobName]["schema"]>,
    options?: JobsOptions
  ) => Promise<EnqueuedJob>
  close: () => Promise<void>
}

export function createJobClient(connection: Redis): JobClient {
  const queues = new Map<string, Queue>()

  function getQueue(queueName: string, defaultJobOptions: JobsOptions): Queue {
    let queue = queues.get(queueName)
    if (!queue) {
      queue = new Queue(queueName, {
        connection,
        defaultJobOptions,
      })
      queues.set(queueName, queue)
    }
    return queue
  }

  return {
    async enqueue(jobName, payload, options) {
      const definition = jobDefinitions[jobName]
      const parsedPayload = definition.schema.parse(payload)

      const jobOptions: JobsOptions = { ...options }
      if ("jobId" in definition) {
        jobOptions.jobId = definition.jobId(parsedPayload as never)
      }

      const queueName =
        typeof definition.queueName === "function"
          ? definition.queueName(parsedPayload as never)
          : definition.queueName
      const defaultJobOptions =
        typeof definition.queueName === "function"
          ? waGatewayQueueDefinition.defaultJobOptions
          : queueDefinitions[definition.queueName].defaultJobOptions
      const job = await getQueue(queueName, defaultJobOptions).add(
        jobName,
        parsedPayload,
        jobOptions
      )

      if (!job.id) {
        throw new Error(`Failed to enqueue job: ${jobName}`)
      }

      return { id: job.id }
    },
    async close() {
      await Promise.all([...queues.values()].map((queue) => queue.close()))
    },
  }
}
