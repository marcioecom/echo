import { UnrecoverableError, type Job } from "bullmq"
import {
  waConnectJobSchema,
  waGatewayJobNames,
  waLogoutJobSchema,
  waPairingCodeJobSchema,
  waSendJobSchema,
} from "@workspace/jobs"

import type { SessionManager } from "../session-manager"

export async function handleWaGatewayJob(
  manager: SessionManager,
  job: Pick<Job, "name" | "data">
): Promise<unknown> {
  if (job.name === waGatewayJobNames.connect) {
    await manager.connect(waConnectJobSchema.parse(job.data))
    return
  }
  if (job.name === waGatewayJobNames.pairingCode) {
    await manager.requestPairingCode(waPairingCodeJobSchema.parse(job.data))
    return
  }
  if (job.name === waGatewayJobNames.send) {
    return manager.send(waSendJobSchema.parse(job.data))
  }
  if (job.name === waGatewayJobNames.logout) {
    await manager.logout(waLogoutJobSchema.parse(job.data))
    return
  }
  throw new UnrecoverableError(`Unknown wa-gateway job: ${job.name}`)
}
