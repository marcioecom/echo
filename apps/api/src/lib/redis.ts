import { Redis } from "ioredis"

export function createRedis(
  redisUrl: string,
  dependencyTimeoutMs: number,
): Redis {
  return new Redis(redisUrl, {
    commandTimeout: dependencyTimeoutMs,
    connectTimeout: dependencyTimeoutMs,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  })
}
