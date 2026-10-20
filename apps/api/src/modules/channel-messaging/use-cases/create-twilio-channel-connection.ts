import type { ChannelConnectionView } from "../channel-connection-view"
import type { Result } from "@/common/result"

import { err, ok } from "@/common/result"

import { credentialsCipher } from "../adapters/channel-credentials-cipher"
import {
  TwilioChannelProvider,
  TwilioConfigurationError,
} from "../adapters/twilio-channel-provider"
import { toChannelConnectionView } from "../channel-connection-view"
import { publishChannelStatusChanged } from "../events/publish-channel-status-changed"
import {
  channelConnectionsRepository,
  ChannelRoutingConflictError,
  OrganizationNotActiveError,
} from "../repositories/channel-connections-repository"

export type TwilioVerificationReason = TwilioConfigurationError["reason"]

export type CreateTwilioChannelError =
  | { type: "organization_unavailable" }
  | { type: "verification_failed"; reason: TwilioVerificationReason }
  | { type: "routing_conflict" }

export async function createTwilioChannelConnection(input: {
  organizationId: string
  operatorUserId: string
  displayName: string
  address: string
  accountSid: string
  authToken: string
  inboxId: string | null
  sandbox: boolean
}): Promise<Result<ChannelConnectionView, CreateTwilioChannelError>> {
  const organizationActive =
    await channelConnectionsRepository.isOrganizationActive(
      input.organizationId
    )
  if (!organizationActive) return err({ type: "organization_unavailable" })

  let verifiedSender: { externalSenderId: string }
  try {
    verifiedSender = await new TwilioChannelProvider(
      input.accountSid,
      input.authToken
    ).verifyWhatsAppSender({
      address: input.address,
      sandbox: input.sandbox,
    })
  } catch (error) {
    const reason: TwilioVerificationReason =
      error instanceof TwilioConfigurationError
        ? error.reason
        : "provider_request_failed"
    await channelConnectionsRepository.recordValidationFailure({
      organizationId: input.organizationId,
      accountSid: input.accountSid,
      address: input.address,
      reason,
      operatorUserId: input.operatorUserId,
    })
    return err({ type: "verification_failed", reason })
  }

  let saved: { channelConnectionId: string }
  try {
    saved = await channelConnectionsRepository.saveManagedTwilioConnection({
      organizationId: input.organizationId,
      operatorUserId: input.operatorUserId,
      displayName: input.displayName,
      inboxId: input.inboxId,
      address: input.address,
      accountSid: input.accountSid,
      externalSenderId: verifiedSender.externalSenderId,
      encryptCredentials: (channelConnectionId) =>
        credentialsCipher.encrypt(input.authToken, {
          organizationId: input.organizationId,
          channelConnectionId,
          provider: "twilio",
        }),
    })
  } catch (error) {
    if (error instanceof ChannelRoutingConflictError) {
      return err({ type: "routing_conflict" })
    }
    if (error instanceof OrganizationNotActiveError) {
      return err({ type: "organization_unavailable" })
    }
    throw error
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
