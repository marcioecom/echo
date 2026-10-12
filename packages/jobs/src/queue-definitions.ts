import type { JobsOptions } from "bullmq"

import { emailQueueName } from "./schemas/email"
import { knowledgeBaseQueueName } from "./schemas/knowledge-base"
import { supportConversationsQueueName } from "./schemas/support-conversations"
import { waGatewayQueueName, waIngressQueueName } from "./schemas/wa-gateway"

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

export const knowledgeBaseQueueDefinition = {
  name: knowledgeBaseQueueName,
  defaultJobOptions,
}

const waJobOptions = {
  ...defaultJobOptions,
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 2_000,
  },
} satisfies JobsOptions

export const waGatewayQueueDefinition = {
  name: waGatewayQueueName,
  defaultJobOptions: waJobOptions,
}

export const waIngressQueueDefinition = {
  name: waIngressQueueName,
  defaultJobOptions,
}

export const queueDefinitions = {
  [emailQueueName]: emailQueueDefinition,
  [supportConversationsQueueName]: supportConversationsQueueDefinition,
  [knowledgeBaseQueueName]: knowledgeBaseQueueDefinition,
  [waGatewayQueueName]: waGatewayQueueDefinition,
  [waIngressQueueName]: waIngressQueueDefinition,
}

export type QueueName = keyof typeof queueDefinitions
