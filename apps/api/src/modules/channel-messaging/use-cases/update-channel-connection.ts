import { err, ok, type Result } from "@/common/result"

import {
  toChannelConnectionView,
  type ChannelConnectionView,
} from "../channel-connection-view"
import { publishChannelStatusChanged } from "../events/publish-channel-status-changed"
import { channelConnectionsRepository } from "../repositories/channel-connections-repository"

export type UpdateChannelConnectionError =
  | { type: "organization_unavailable" }
  | { type: "not_found" }
  | { type: "missing_address" }

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
  if (result !== "updated") return err({ type: result })

  const connection = await channelConnectionsRepository.findForOrganization(
    input.organizationId,
    input.channelConnectionId
  )
  if (!connection) return err({ type: "not_found" })

  await publishChannelStatusChanged({
    organizationId: input.organizationId,
    channelConnectionId: connection.id,
  })
  return ok(toChannelConnectionView(connection))
}
