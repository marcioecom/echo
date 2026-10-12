import { err, ok, type Result } from "@/common/result"

import { publishChannelStatusChanged } from "../events/publish-channel-status-changed"
import { channelConnectionsRepository } from "../repositories/channel-connections-repository"
import { enqueueBaileysLogout } from "./enqueue-baileys-logout"

export type DeleteChannelConnectionError =
  | { type: "organization_unavailable" }
  | { type: "not_found" }

export async function deleteChannelConnection(input: {
  organizationId: string
  channelConnectionId: string
  operatorUserId: string
}): Promise<Result<void, DeleteChannelConnectionError>> {
  const result =
    await channelConnectionsRepository.disableChannelConnection(input)
  if (result !== "disabled") return err({ type: result })

  const connection = await channelConnectionsRepository.findForOrganization(
    input.organizationId,
    input.channelConnectionId
  )
  if (connection?.provider === "baileys") {
    await enqueueBaileysLogout({
      organizationId: input.organizationId,
      channelConnectionId: input.channelConnectionId,
    })
  }

  await publishChannelStatusChanged({
    organizationId: input.organizationId,
    channelConnectionId: input.channelConnectionId,
  })
  return ok(undefined)
}
