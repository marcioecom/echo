import { UnrecoverableError, type Job } from "bullmq"
import {
  waConnectJobSchema,
  waGatewayJobNames,
  waLogoutJobSchema,
} from "@workspace/jobs"

import type { SessionRegistry } from "../ownership/registry"

export async function handleWaGatewayJob(
  registry: SessionRegistry,
  job: Pick<Job, "name" | "data">
): Promise<unknown> {
  if (job.name === waGatewayJobNames.connect) {
    await registry.connect(waConnectJobSchema.parse(job.data))
    return
  }
  if (job.name === waGatewayJobNames.logout) {
    await registry.logout(waLogoutJobSchema.parse(job.data))
    return
  }
  throw new UnrecoverableError(`Unknown wa-gateway job: ${job.name}`)
}
