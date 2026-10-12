import { err, ok, type Result } from "@/common/result"

import { publishChannelStatusChanged } from "../events/publish-channel-status-changed"
import { channelConnectionsRepository } from "../repositories/channel-connections-repository"

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

  await publishChannelStatusChanged({
    organizationId: input.organizationId,
    channelConnectionId: input.channelConnectionId,
  })
  return ok(undefined)
}
