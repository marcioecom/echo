import { waGatewayJobNames } from "@workspace/jobs"
import { createLoggerWithContext } from "@workspace/logger"

import { jobs } from "@/lib/jobs-client"

const logger = createLoggerWithContext("api:channel-messaging:baileys")

export async function enqueueBaileysLogout(input: {
  organizationId: string
  channelConnectionId: string
}): Promise<void> {
  try {
    await jobs.enqueue(waGatewayJobNames.logout, input)
  } catch (error) {
    logger.error("failed to enqueue Baileys logout", {
      error,
      organizationId: input.organizationId,
      channelConnectionId: input.channelConnectionId,
    })
  }
}
