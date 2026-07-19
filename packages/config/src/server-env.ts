import { z } from "zod"

export const defaultDependencyTimeoutMs = 5_000

export const serverEnvSchema = z.object({
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  DEPENDENCY_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(defaultDependencyTimeoutMs),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
})

export function loadEnv<T extends z.ZodType>(
  schema: T,
  input: Record<string, string | undefined> = process.env,
): z.output<T> {
  const result = schema.safeParse(input)

  if (!result.success) {
    throw new Error(z.prettifyError(result.error))
  }

  return result.data
}
