import { loadEnv, serverEnvSchema } from "@workspace/config"
import { z } from "zod"

const encryptionKeySchema = z.string().refine((value) => {
  const decoded = Buffer.from(value, "base64")
  return decoded.length === 32 && decoded.toString("base64") === value
}, "must be a canonical base64-encoded 32-byte key")

const workerEnvSchema = serverEnvSchema.extend({
  WORKER_HOST: z.string().default("0.0.0.0"),
  WORKER_PORT: z.coerce.number().int().min(1).max(65_535).default(3002),
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().min(1),
  PUBLIC_API_URL: z.url(),
  CHANNEL_CREDENTIALS_ENCRYPTION_KEY: encryptionKeySchema,
  CHANNEL_CREDENTIALS_KEY_VERSION: z.string().min(1),
  R2_ENDPOINT: z.url(),
  R2_BUCKET_NAME: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  AI_GATEWAY_API_KEY: z.string().min(1),
  AI_EMBEDDING_MODEL: z.literal("openai/text-embedding-3-small").default(
    "openai/text-embedding-3-small"
  ),
  AI_CHAT_MODEL: z.literal("openai/gpt-5.6-luna").default("openai/gpt-5.6-luna"),
})

export type WorkerEnv = z.output<typeof workerEnvSchema>

export const env = loadEnv(workerEnvSchema)
