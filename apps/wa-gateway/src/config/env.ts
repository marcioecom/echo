import { loadEnv, serverEnvSchema } from "@workspace/config"
import { z } from "zod"

const encryptionKeySchema = z.string().refine((value) => {
  const decoded = Buffer.from(value, "base64")
  return decoded.length === 32 && decoded.toString("base64") === value
}, "must be a canonical base64-encoded 32-byte key")

const gatewayEnvSchema = serverEnvSchema.extend({
  WA_GATEWAY_HOST: z.string().default("0.0.0.0"),
  WA_GATEWAY_PORT: z.coerce.number().int().min(1).max(65_535).default(3003),
  CHANNEL_CREDENTIALS_ENCRYPTION_KEY: encryptionKeySchema,
  CHANNEL_CREDENTIALS_KEY_VERSION: z.string().min(1),
  WA_AUTH_FLUSH_MS: z.coerce.number().int().min(0).default(1_000),
  WA_AUTH_BATCH_SIZE: z.coerce.number().int().min(1).default(25),
  WA_PAIRING_TIMEOUT_MS: z.coerce.number().int().positive().default(180_000),
  WA_SEND_INTERVAL_MS: z.coerce.number().int().positive().default(1_000),
  WA_CONTACT_INTERVAL_MS: z.coerce.number().int().positive().default(3_000),
  WA_COMPOSE_MS_PER_CHAR: z.coerce.number().int().min(0).default(30),
  WA_COMPOSE_MIN_MS: z.coerce.number().int().min(0).default(1_000),
  WA_COMPOSE_MAX_MS: z.coerce.number().int().min(0).default(6_000),
  R2_ENDPOINT: z.url(),
  R2_BUCKET_NAME: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  POD_NAME: z.string().min(1).optional(),
})

export type GatewayEnv = z.output<typeof gatewayEnvSchema>

export const env = loadEnv(gatewayEnvSchema)
