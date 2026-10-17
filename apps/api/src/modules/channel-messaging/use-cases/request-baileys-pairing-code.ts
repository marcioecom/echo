import { waGatewayJobNames } from "@workspace/jobs"
import { err, ok, type Result } from "@/common/result"
import { jobs } from "@/lib/jobs-client"

import { channelConnectionsRepository } from "../repositories/channel-connections-repository"

export type RequestBaileysPairingCodeError =
  | { type: "organization_unavailable" }
  | { type: "not_found" }
  | { type: "queue_unavailable" }

export async function requestBaileysPairingCode(input: {
  organizationId: string
  channelConnectionId: string
  phoneNumber: string
}): Promise<Result<void, RequestBaileysPairingCodeError>> {
  const organizationActive =
    await channelConnectionsRepository.isOrganizationActive(
      input.organizationId
    )
  if (!organizationActive) return err({ type: "organization_unavailable" })

  const connection = await channelConnectionsRepository.findForOrganization(
    input.organizationId,
    input.channelConnectionId
  )
  if (
    !connection ||
    connection.provider !== "baileys" ||
    connection.status === "disabled"
  ) {
    return err({ type: "not_found" })
  }

  try {
    await jobs.enqueue(waGatewayJobNames.pairingCode, {
      organizationId: input.organizationId,
      channelConnectionId: input.channelConnectionId,
      phoneNumber: input.phoneNumber,
    })
  } catch {
    return err({ type: "queue_unavailable" })
  }

  return ok(undefined)
}
