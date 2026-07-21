import { Queue } from "bullmq";
import { emailQueueName } from "../schemas/email";
import { emailQueueConfig } from "./email.config";

export const emailQueue = new Queue(emailQueueName, emailQueueConfig.queueOptions);
