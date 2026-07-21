import { Job, QueueOptions, WorkerOptions } from "bullmq"

/**
 * Job info with full data access for event handlers
 */
export interface JobInfo {
  name?: string
  id?: string
  data?: unknown
  attemptsMade?: number
  opts?: { attempts?: number }
}

/**
 * Configuration for a queue and its worker
 */
export interface QueueConfig {
  /** Queue name */
  name: string
  /** Queue options for BullMQ */
  queueOptions: QueueOptions
  /** Worker options for BullMQ */
  workerOptions: WorkerOptions
  /** Optional custom event handlers */
  eventHandlers?: {
    onCompleted?: (job: { name: string; id?: string }) => void
    onFailed?: (job: Job | null, err: Error) => void | Promise<void>
  }
}
