import { Queue } from "bullmq"
import { QueueConfig } from "../types/queue-config"
import { emailQueue } from "./email"
import { emailQueueConfig } from "./email.config"
import { knowledgeBaseQueue } from "./knowledge-base"
import { knowledgeBaseQueueConfig } from "./knowledge-base.config"
import { supportConversationsQueue } from "./support-conversations"
import { supportConversationsQueueConfig } from "./support-conversations.config"
import { waGatewayQueue, waIngressQueue } from "./whatsapp"

export const queuesConfigs: QueueConfig[] = [
  emailQueueConfig,
  supportConversationsQueueConfig,
  knowledgeBaseQueueConfig,
]

export function getAllQueues(): Queue[] {
  return [
    emailQueue,
    supportConversationsQueue,
    knowledgeBaseQueue,
    waGatewayQueue,
    waIngressQueue,
  ]
}
