import type { Result } from "@/common/result"

import { err, ok } from "@/common/result"

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
    await channelConnectionsRepository.removeChannelConnection(input)
  if (
    result.outcome === "not_found" ||
    result.outcome === "organization_unavailable"
  ) {
    return err({ type: result.outcome })
  }

  if (result.provider === "baileys") {
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
