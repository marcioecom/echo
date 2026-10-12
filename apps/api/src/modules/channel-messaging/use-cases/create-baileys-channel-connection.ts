import { waGatewayJobNames } from "@workspace/jobs"

import { err, ok, type Result } from "@/common/result"
import { jobs } from "@/lib/jobs-client"

import { credentialsCipher } from "../adapters/channel-credentials-cipher"
import {
  toChannelConnectionView,
  type ChannelConnectionView,
} from "../channel-connection-view"
import { publishChannelStatusChanged } from "../events/publish-channel-status-changed"
import {
  BaileysSessionExistsError,
  ChannelRoutingConflictError,
  channelConnectionsRepository,
  OrganizationNotActiveError,
} from "../repositories/channel-connections-repository"

export type CreateBaileysChannelError =
  | { type: "organization_unavailable" }
  | { type: "session_exists" }
  | { type: "routing_conflict" }
  | { type: "queue_unavailable" }

export async function createBaileysChannelConnection(input: {
  organizationId: string
  operatorUserId: string
  displayName: string
  inboxId: string | null
}): Promise<Result<ChannelConnectionView, CreateBaileysChannelError>> {
  let saved: { channelConnectionId: string }
  try {
    saved = await channelConnectionsRepository.savePendingBaileysConnection({
      organizationId: input.organizationId,
      operatorUserId: input.operatorUserId,
      displayName: input.displayName,
      inboxId: input.inboxId,
      encryptCredentials: (channelConnectionId) =>
        credentialsCipher.encrypt("baileys", {
          organizationId: input.organizationId,
          channelConnectionId,
          provider: "baileys",
        }),
    })
  } catch (error) {
    if (error instanceof OrganizationNotActiveError) {
      return err({ type: "organization_unavailable" })
    }
    if (error instanceof BaileysSessionExistsError) {
      return err({ type: "session_exists" })
    }
    if (error instanceof ChannelRoutingConflictError) {
      return err({ type: "routing_conflict" })
    }
    throw error
  }

  try {
    await jobs.enqueue(waGatewayJobNames.connect, {
      organizationId: input.organizationId,
      channelConnectionId: saved.channelConnectionId,
    })
  } catch {
    return err({ type: "queue_unavailable" })
  }

  const connection = await channelConnectionsRepository.findForOrganization(
    input.organizationId,
    saved.channelConnectionId
  )
  if (!connection) return err({ type: "organization_unavailable" })

  await publishChannelStatusChanged({
    organizationId: input.organizationId,
    channelConnectionId: connection.id,
  })

  return ok(toChannelConnectionView(connection))
}
