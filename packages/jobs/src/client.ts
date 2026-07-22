import type { JobsOptions } from "bullmq"
import { Queue } from "bullmq"
import type { Redis } from "ioredis"
import type { z } from "zod"
import { jobDefinitions, type JobName } from "./schemas"

export interface EnqueuedJob {
  id: string
}

export interface JobClient {
  enqueue: <TJobName extends JobName>(
    jobName: TJobName,
    payload: z.input<(typeof jobDefinitions)[TJobName]["schema"]>,
    options?: JobsOptions,
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
    async enqueue(jobName, payload, options) {
      const definition = jobDefinitions[jobName]
      const job = await getQueue(definition.queueName).add(
        jobName,
        definition.schema.parse(payload),
        { ...options }
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
