import { Redis } from "ioredis"

import { env } from "../config/env"

export const redisConnection = new Redis(env.REDIS_URL, {
  connectTimeout: env.DEPENDENCY_TIMEOUT_MS,
  lazyConnect: true,
  maxRetriesPerRequest: null,
})

export async function pingRedis(): Promise<void> {
  await redisConnection.ping()
}
