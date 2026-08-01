import { credentialsCipher } from "../adapters/channel-credentials-cipher"
import {
  TwilioChannelProvider,
  TwilioConfigurationError,
} from "../adapters/twilio-channel-provider"
import { channelConnectionsRepository } from "../repositories/channel-connections-repository"
import {
  provisionTwilioWhatsAppSchema,
  type ProvisionTwilioWhatsAppInput,
} from "../schemas"

export class OrganizationUnavailableError extends Error {
  constructor() {
    super("Organization is not available for channel provisioning")
    this.name = "OrganizationUnavailableError"
  }
}

export async function provisionWhatsAppChannelConnection(
  rawInput: ProvisionTwilioWhatsAppInput
) {
  const input = provisionTwilioWhatsAppSchema.parse(rawInput)

  const orgActive = await channelConnectionsRepository.isOrganizationActive(
    input.organizationId
  )
  if (!orgActive) {
    throw new OrganizationUnavailableError()
  }

  const twilioProvider = new TwilioChannelProvider(
    input.accountSid,
    input.authToken
  )

  let verifiedSender: { externalSenderId: string }
  try {
    verifiedSender = await twilioProvider.verifyWhatsAppSender({
      address: input.address,
      sandbox: input.sandbox,
    })
  } catch (error) {
    const reason =
      error instanceof TwilioConfigurationError
        ? error.reason
        : "provider_request_failed"
    await channelConnectionsRepository.recordValidationFailure({
      organizationId: input.organizationId,
      accountSid: input.accountSid,
      address: input.address,
      reason,
    })
    throw error
  }

  const result =
    await channelConnectionsRepository.saveVerifiedTwilioConnection({
      organizationId: input.organizationId,
      name: input.name,
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

  return {
    organizationId: input.organizationId,
    channelConnectionId: result.channelConnectionId,
    channelType: "whatsapp" as const,
    address: input.address,
    status: "active" as const,
    provider: "twilio" as const,
  }
}
