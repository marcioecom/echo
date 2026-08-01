import { password } from "@inquirer/prompts"
import { parseArgs } from "node:util"

import { database } from "../../../lib/db"
import { provisionWhatsAppChannelConnection } from "../use-cases/provision-whatsapp-channel-connection"
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

  const result = await provisionWhatsAppChannelConnection({
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
