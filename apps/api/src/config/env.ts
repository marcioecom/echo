import { loadEnv, serverEnvSchema } from "@workspace/config"
import { z } from "zod"

const encryptionKeySchema = z.string().refine((value) => {
  const decoded = Buffer.from(value, "base64")
  return decoded.length === 32 && decoded.toString("base64") === value
}, "must be a canonical base64-encoded 32-byte key")

const apiEnvSchema = serverEnvSchema.extend({
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  WEB_APP_URL: z.url(),
  PUBLIC_API_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(1),
  CHANNEL_CREDENTIALS_ENCRYPTION_KEY: encryptionKeySchema,
  CHANNEL_CREDENTIALS_KEY_VERSION: z.string().min(1),
})

export type ApiEnv = z.output<typeof apiEnvSchema>

function loadApiEnv(): ApiEnv {
  return loadEnv(apiEnvSchema)
}

export const env = loadApiEnv()
