import { err, ok, type Result } from "@/common/result"

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
  | { type: "pairing_required" }

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
