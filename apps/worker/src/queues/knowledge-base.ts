import { Queue } from "bullmq"

import { knowledgeBaseQueueConfig } from "./knowledge-base.config"

export const knowledgeBaseQueue = new Queue(knowledgeBaseQueueConfig.name, knowledgeBaseQueueConfig.queueOptions)
