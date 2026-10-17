import { UnrecoverableError, type Job } from "bullmq"
import {
  waGatewayJobNames,
  waPairingCodeJobSchema,
  waSendJobSchema,
} from "@workspace/jobs"

import type { SessionRegistry } from "../ownership/registry"

export async function handleWaConnectionJob(
  registry: SessionRegistry,
  job: Pick<Job, "name" | "data">
): Promise<unknown> {
  if (job.name === waGatewayJobNames.pairingCode) {
    await registry.requestPairingCode(waPairingCodeJobSchema.parse(job.data))
    return
  }
  if (job.name === waGatewayJobNames.send) {
    return registry.send(waSendJobSchema.parse(job.data))
  }
  throw new UnrecoverableError(`Unknown connection job: ${job.name}`)
}
