import type { ChannelConnectionView } from "../channel-connection-view"
import type { Result } from "@/common/result"

import { waGatewayJobNames } from "@workspace/jobs"

import { err, ok } from "@/common/result"
import { capture } from "@/lib/analytics"
import { jobs } from "@/lib/jobs-client"

import { credentialsCipher } from "../adapters/channel-credentials-cipher"
import { toChannelConnectionView } from "../channel-connection-view"
import { publishChannelStatusChanged } from "../events/publish-channel-status-changed"
import {
  channelConnectionsRepository,
  ChannelRoutingConflictError,
  OrganizationNotActiveError,
} from "../repositories/channel-connections-repository"

export type CreateBaileysChannelError =
  | { type: "organization_unavailable" }
  | { type: "routing_conflict" }
  | { type: "queue_unavailable" }

export async function createBaileysChannelConnection(input: {
  organizationId: string
  operatorUserId: string
  displayName: string
  inboxId: string | null
}): Promise<Result<ChannelConnectionView, CreateBaileysChannelError>> {
  let saved: { channelConnectionId: string; created: boolean }
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
    if (error instanceof ChannelRoutingConflictError) {
      return err({ type: "routing_conflict" })
    }
    throw error
  }

  const connection = await channelConnectionsRepository.findForOrganization(
    input.organizationId,
    saved.channelConnectionId
  )
  if (!connection) return err({ type: "organization_unavailable" })

  if (saved.created) {
    capture("channel_connection_created", {
      organizationId: input.organizationId,
      distinctId: input.operatorUserId,
      properties: { channelType: connection.channelType },
    })
  }

  try {
    await jobs.enqueue(waGatewayJobNames.connect, {
      organizationId: input.organizationId,
      channelConnectionId: saved.channelConnectionId,
    })
  } catch {
    return err({ type: "queue_unavailable" })
  }

  await publishChannelStatusChanged({
    organizationId: input.organizationId,
    channelConnectionId: connection.id,
  })

  return ok(toChannelConnectionView(connection))
}
