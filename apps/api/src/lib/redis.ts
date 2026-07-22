import { Redis } from "ioredis"

import { env } from "../config/env"

export function createRedis(
  redisUrl: string,
  dependencyTimeoutMs: number
): Redis {
  return new Redis(redisUrl, {
    commandTimeout: dependencyTimeoutMs,
    connectTimeout: dependencyTimeoutMs,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  })
}

export const redisConnection = createRedis(
  env.REDIS_URL,
  env.DEPENDENCY_TIMEOUT_MS
)

export async function pingRedis(): Promise<void> {
  await redisConnection.ping()
}
