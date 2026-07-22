import { emailQueueName } from "@workspace/jobs"
import { Queue } from "bullmq"
import { emailQueueConfig } from "./email.config"

export const emailQueue = new Queue(
  emailQueueName,
  emailQueueConfig.queueOptions
)
