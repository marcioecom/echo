import { waGatewayJobNames } from "@workspace/jobs"

import { err, ok, type Result } from "@/common/result"
import { jobs } from "@/lib/jobs-client"

import {
  toChannelConnectionView,
  type ChannelConnectionView,
} from "../channel-connection-view"
import { publishChannelStatusChanged } from "../events/publish-channel-status-changed"
import { channelConnectionsRepository } from "../repositories/channel-connections-repository"
import { enqueueBaileysLogout } from "./enqueue-baileys-logout"

export type UpdateChannelConnectionError =
  | { type: "organization_unavailable" }
  | { type: "not_found" }
  | { type: "missing_address" }
  | { type: "session_exists" }
  | { type: "queue_unavailable" }

export async function updateChannelConnection(input: {
  organizationId: string
  channelConnectionId: string
  operatorUserId: string
  displayName?: string
  inboxId?: string | null
  status?: "active" | "disabled"
}): Promise<Result<ChannelConnectionView, UpdateChannelConnectionError>> {
  const result =
    await channelConnectionsRepository.updateChannelConnection(input)
  if (result !== "updated" && result !== "pairing_started") {
    return err({ type: result })
  }

  if (result === "pairing_started") {
    try {
      await jobs.enqueue(waGatewayJobNames.connect, {
        organizationId: input.organizationId,
        channelConnectionId: input.channelConnectionId,
      })
    } catch {
      await channelConnectionsRepository.disableChannelConnection(input)
      return err({ type: "queue_unavailable" })
    }
  }

  const connection = await channelConnectionsRepository.findForOrganization(
    input.organizationId,
    input.channelConnectionId
  )
  if (!connection) return err({ type: "not_found" })

  if (input.status === "disabled" && connection.provider === "baileys") {
    await enqueueBaileysLogout({
      organizationId: input.organizationId,
      channelConnectionId: connection.id,
    })
  }

  await publishChannelStatusChanged({
    organizationId: input.organizationId,
    channelConnectionId: connection.id,
  })
  return ok(toChannelConnectionView(connection))
}
