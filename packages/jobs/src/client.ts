import type { JobsOptions } from "bullmq"
import { Queue } from "bullmq"
import type { Redis } from "ioredis"
import type { z } from "zod"
import { queueDefinitions, type QueueName } from "./queue-definitions"
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
  const queues = new Map<QueueName, Queue>()

  function getQueue(queueName: QueueName): Queue {
    let queue = queues.get(queueName)
    if (!queue) {
      queue = new Queue(queueName, {
        connection,
        defaultJobOptions: queueDefinitions[queueName].defaultJobOptions,
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

      const job = await getQueue(definition.queueName).add(
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
