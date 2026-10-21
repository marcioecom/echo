import type { SessionRegistry } from "../ownership/registry"
import type { Job } from "bullmq"

import {
  waGatewayJobNames,
  waMediaJobSchema,
  waPairingCodeJobSchema,
  waSendJobSchema,
} from "@workspace/jobs"
import { UnrecoverableError } from "bullmq"

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
  if (job.name === waGatewayJobNames.media) {
    return registry.downloadMedia(waMediaJobSchema.parse(job.data))
  }
  throw new UnrecoverableError(`Unknown connection job: ${job.name}`)
}
