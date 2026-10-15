import type { JobsOptions } from "bullmq"
import { Queue } from "bullmq"
import type { Redis } from "ioredis"
import type { z } from "zod"
import { scheduleSlidingDebounce } from "./inbound-debounce"
import { queueDefinitions, type QueueName } from "./queue-definitions"
import { jobDefinitions, type JobName } from "./schemas"

export interface EnqueuedJob {
  id: string
}

export interface ScheduleDebouncedOptions {
  debounceKey: string
  windowMs: number
  maxWaitMs: number
  now?: number
}

export interface JobClient {
  enqueue: <TJobName extends JobName>(
    jobName: TJobName,
    payload: z.input<(typeof jobDefinitions)[TJobName]["schema"]>,
    options?: JobsOptions
  ) => Promise<EnqueuedJob>
  scheduleDebounced: <TJobName extends JobName>(
    jobName: TJobName,
    payload: z.input<(typeof jobDefinitions)[TJobName]["schema"]>,
    options: ScheduleDebouncedOptions
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
    async scheduleDebounced(jobName, payload, options) {
      if (!/^[\w.-]+$/.test(options.debounceKey)) {
        throw new Error("Debounce key must be a BullMQ-safe job id fragment")
      }
      const definition = jobDefinitions[jobName]
      const parsedPayload = definition.schema.parse(payload)
      const queue = getQueue(definition.queueName)
      return scheduleSlidingDebounce(queue, {
        jobName,
        jobId: `${jobName}--${options.debounceKey}`,
        payload: parsedPayload,
        windowMs: options.windowMs,
        maxWaitMs: options.maxWaitMs,
        now: options.now,
      })
    },
    async close() {
      await Promise.all([...queues.values()].map((queue) => queue.close()))
    },
  }
}
