import { Queue } from "bullmq"
import { QueueConfig } from "../types/queue-config"
import { emailQueue } from "./email"
import { emailQueueConfig } from "./email.config"
import { supportConversationsQueue } from "./support-conversations"
import { supportConversationsQueueConfig } from "./support-conversations.config"

export const queuesConfigs: QueueConfig[] = [
  emailQueueConfig,
  supportConversationsQueueConfig,
]

export function getAllQueues(): Queue[] {
  return [emailQueue, supportConversationsQueue]
}
