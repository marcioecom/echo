import { loadEnv, serverEnvSchema } from "@workspace/config"
import { z } from "zod"

const apiEnvSchema = serverEnvSchema.extend({
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.url(),
  WEB_APP_URL: z.url(),
})

export type ApiEnv = z.output<typeof apiEnvSchema>

export function loadApiEnv(): ApiEnv {
  return loadEnv(apiEnvSchema)
}
