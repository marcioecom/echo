import type { ChannelCredentialsCipher } from "../adapters/channel-credentials-cipher"
import type { TwilioChannelProvider } from "../adapters/twilio-channel-provider"
import { TwilioConfigurationError } from "../adapters/twilio-channel-provider"
import type { ChannelConnectionsRepository } from "../repositories/channel-connections-repository"
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

export function createProvisionWhatsAppChannelConnection(dependencies: {
  repository: ChannelConnectionsRepository
  credentialsCipher: ChannelCredentialsCipher
  twilioProvider: TwilioChannelProvider
}) {
  return async (rawInput: ProvisionTwilioWhatsAppInput) => {
    const input = provisionTwilioWhatsAppSchema.parse(rawInput)
    if (
      !(await dependencies.repository.isOrganizationActive(
        input.organizationId
      ))
    ) {
      throw new OrganizationUnavailableError()
    }

    let verifiedSender: { externalSenderId: string }
    try {
      verifiedSender = await dependencies.twilioProvider.verifyWhatsAppSender({
        accountSid: input.accountSid,
        authToken: input.authToken,
        address: input.address,
        sandbox: input.sandbox,
      })
    } catch (error) {
      const reason =
        error instanceof TwilioConfigurationError
          ? error.reason
          : "provider_request_failed"
      await dependencies.repository.recordValidationFailure({
        organizationId: input.organizationId,
        accountSid: input.accountSid,
        address: input.address,
        reason,
      })
      throw error
    }

    const result = await dependencies.repository.saveVerifiedTwilioConnection({
      organizationId: input.organizationId,
      name: input.name,
      address: input.address,
      accountSid: input.accountSid,
      externalSenderId: verifiedSender.externalSenderId,
      encryptCredentials: (channelConnectionId) =>
        dependencies.credentialsCipher.encrypt(input.authToken, {
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
}
