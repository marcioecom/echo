import { Queue } from "bullmq"
import { QueueConfig } from "../types/queue-config"
import { emailQueue } from "./email"
import { emailQueueConfig } from "./email.config"

export const queuesConfigs: QueueConfig = [emailQueueConfig]

export function getAllQueues(): Queue[] {
  return [emailQueue]
}
