import { loadEnv, serverEnvSchema } from "@workspace/config"
import { z } from "zod"

const workerEnvSchema = serverEnvSchema.extend({
  WORKER_HOST: z.string().default("0.0.0.0"),
  WORKER_PORT: z.coerce.number().int().min(1).max(65_535).default(3002),
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().min(1),
})

export type WorkerEnv = z.output<typeof workerEnvSchema>

export function loadWorkerEnv(): WorkerEnv {
  return loadEnv(workerEnvSchema)
}
