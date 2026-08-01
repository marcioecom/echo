import { parseArgs } from "node:util"

import { password } from "@inquirer/prompts"

import { createChannelCredentialsCipher } from "../adapters/channel-credentials-cipher"
import { createTwilioChannelProvider } from "../adapters/twilio-channel-provider"
import { createChannelConnectionsRepository } from "../repositories/channel-connections-repository"
import { createProvisionWhatsAppChannelConnection } from "../services/provision-whatsapp-channel-connection"
import { env } from "../../../config/env"
import { database } from "../../../lib/db"
import {
  formatProvisioningError,
  formatProvisioningFailure,
  resolveAuthToken,
} from "./provision-twilio-whatsapp-cli"

async function readPipedInput(): Promise<string> {
  process.stdin.setEncoding("utf8")
  let value = ""
  for await (const chunk of process.stdin) {
    value += chunk
  }
  return value
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      "organization-id": { type: "string" },
      name: { type: "string" },
      address: { type: "string" },
      "account-sid": { type: "string" },
      sandbox: { type: "boolean", default: false },
    },
    strict: true,
  })
  const authToken = await resolveAuthToken({
    interactive: Boolean(process.stdin.isTTY),
    prompt: () =>
      password({
        message: "Twilio Auth Token",
        mask: "*",
      }),
    readPipedInput,
  })
  const provision = createProvisionWhatsAppChannelConnection({
    repository: createChannelConnectionsRepository(database.db),
    credentialsCipher: createChannelCredentialsCipher({
      encryptionKey: env.CHANNEL_CREDENTIALS_ENCRYPTION_KEY,
      keyVersion: env.CHANNEL_CREDENTIALS_KEY_VERSION,
    }),
    twilioProvider: createTwilioChannelProvider(),
  })

  const result = await provision({
    organizationId: values["organization-id"] ?? "",
    name: values.name ?? "",
    address: values.address ?? "",
    accountSid: values["account-sid"] ?? "",
    authToken,
    sandbox: values.sandbox,
  })
  process.stdout.write(`${JSON.stringify(result)}\n`)
}

async function run(): Promise<void> {
  try {
    await main()
  } catch (error) {
    process.stderr.write(
      formatProvisioningFailure(
        formatProvisioningError(error),
        Boolean(process.stderr.isTTY)
      )
    )
    process.exitCode = 1
  } finally {
    await database.close()
  }
}

void run()
