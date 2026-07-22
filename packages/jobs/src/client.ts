import type { JobsOptions } from "bullmq"
import { Queue } from "bullmq"
import type { Redis } from "ioredis"
import type { z } from "zod"
import { EmailJobName } from "./schemas"

export interface EnqueuedJob {
  id: string
}

export interface JobClient {
  enqueue: <TSchema extends z.ZodType>(
    jobName: EmailJobName, // TODO: add new job names later
    payload: z.input<TSchema>,
    queueName: string,
    options?: JobsOptions
  ) => Promise<EnqueuedJob>
  close: () => Promise<void>
}

export function createJobClient(connection: Redis): JobClient {
  const queues = new Map<string, Queue>()

  function getQueue(queueName: string): Queue {
    let queue = queues.get(queueName)
    if (!queue) {
      queue = new Queue(queueName, { connection })
      queues.set(queueName, queue)
    }
    return queue
  }

  return {
    async enqueue(jobName, payload, queueName, options) {
      const job = await getQueue(queueName).add(
        jobName, payload, { ...options }
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
