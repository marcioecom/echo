import { Redis } from "ioredis"
import { env } from "../config/env"

function createRedis(redisUrl: string, dependencyTimeoutMs: number): Redis {
  return new Redis(redisUrl, {
    commandTimeout: dependencyTimeoutMs,
    connectTimeout: dependencyTimeoutMs,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  })
}

function createWorkerRedisConnection(redisUrl: string): Redis {
  return new Redis(redisUrl, {
    maxRetriesPerRequest: null,
  })
}

// TODO: maybe unify the redis connection to only one
export const redisConnection = createRedis(
  env.REDIS_URL,
  env.DEPENDENCY_TIMEOUT_MS
)

export const workerRedisConnection = createWorkerRedisConnection(env.REDIS_URL)
