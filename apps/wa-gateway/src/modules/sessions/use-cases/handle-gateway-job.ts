import { UnrecoverableError, type Job } from "bullmq"
import {
  waConnectJobSchema,
  waGatewayJobNames,
  waLogoutJobSchema,
  waPairingCodeJobSchema,
  waSendJobSchema,
} from "@workspace/jobs"

import { SessionBusyError } from "../errors"
import type { SessionRegistry } from "../registry"

export async function handleWaGatewayJob(
  registry: SessionRegistry,
  job: Pick<Job, "name" | "data">
): Promise<unknown> {
  if (job.name === waGatewayJobNames.connect) {
    try {
      await registry.connect(waConnectJobSchema.parse(job.data))
    } catch (error) {
      if (error instanceof SessionBusyError) {
        throw new UnrecoverableError("session_busy")
      }
      throw error
    }
    return
  }
  if (job.name === waGatewayJobNames.pairingCode) {
    await registry.requestPairingCode(waPairingCodeJobSchema.parse(job.data))
    return
  }
  if (job.name === waGatewayJobNames.send) {
    return registry.send(waSendJobSchema.parse(job.data))
  }
  if (job.name === waGatewayJobNames.logout) {
    await registry.logout(waLogoutJobSchema.parse(job.data))
    return
  }
  throw new UnrecoverableError(`Unknown wa-gateway job: ${job.name}`)
}
