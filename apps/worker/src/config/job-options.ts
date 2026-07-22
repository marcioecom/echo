import { JobsOptions } from "bullmq"

export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 4,
  backoff: {
    type: "exponential",
    delay: 5 * 60 * 1000,
  },
}
