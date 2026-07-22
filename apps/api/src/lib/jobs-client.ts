import { createJobClient } from "@workspace/jobs"

import { redisConnection } from "./redis"

export const jobs = createJobClient(redisConnection)
