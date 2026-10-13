import {
  waGatewayQueueDefinition,
  waIngressQueueDefinition,
} from "@workspace/jobs"
import { Queue } from "bullmq"

import { redisConnection } from "../lib/redis"

export const waGatewayQueue = new Queue(waGatewayQueueDefinition.name, {
  connection: redisConnection,
  defaultJobOptions: waGatewayQueueDefinition.defaultJobOptions,
})

export const waIngressQueue = new Queue(waIngressQueueDefinition.name, {
  connection: redisConnection,
  defaultJobOptions: waIngressQueueDefinition.defaultJobOptions,
})
