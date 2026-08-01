import type { JobsOptions } from "bullmq"

import { emailQueueName } from "./schemas/email"
import { supportConversationsQueueName } from "./schemas/support-conversations"

const defaultJobOptions = {
  attempts: 4,
  backoff: {
    type: "exponential",
    delay: 5 * 60 * 1000,
  },
  removeOnComplete: {
    age: 24 * 60 * 60,
    count: 1_000,
  },
  removeOnFail: {
    age: 7 * 24 * 60 * 60,
  },
} satisfies JobsOptions

export const emailQueueDefinition = {
  name: emailQueueName,
  defaultJobOptions,
}

export const supportConversationsQueueDefinition = {
  name: supportConversationsQueueName,
  defaultJobOptions,
}

export const queueDefinitions = {
  [emailQueueName]: emailQueueDefinition,
  [supportConversationsQueueName]: supportConversationsQueueDefinition,
}

export type QueueName = keyof typeof queueDefinitions
