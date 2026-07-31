import { supportConversationsQueueName } from "@workspace/jobs"
import { Queue } from "bullmq"

import { supportConversationsQueueConfig } from "./support-conversations.config"

export const supportConversationsQueue = new Queue(
  supportConversationsQueueName,
  supportConversationsQueueConfig.queueOptions
)
