import { Redis } from "ioredis"
import { env } from "../config/env"

export function createRedis(
  redisUrl: string,
  dependencyTimeoutMs: number
): Redis {
  return new Redis(redisUrl, {
    connectTimeout: dependencyTimeoutMs,
    lazyConnect: true,
    maxRetriesPerRequest: null,
  })
}

export const redisConnection = createRedis(
  env.REDIS_URL,
  env.DEPENDENCY_TIMEOUT_MS
)

export async function pingRedis(): Promise<void> {
  let timeout: NodeJS.Timeout | undefined

  try {
    await Promise.race([
      redisConnection.ping(),
      new Promise((_, reject) => {
        timeout = setTimeout(() => {
          reject(
            new Error(
              `Redis ping timed out after ${env.DEPENDENCY_TIMEOUT_MS}ms`
            )
          )
        }, env.DEPENDENCY_TIMEOUT_MS)
        timeout.unref?.()
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}
