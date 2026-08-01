import { describe, expect, it, vi } from "vitest"

import { TwilioConfigurationError } from "../adapters/twilio-channel-provider"
import {
  formatProvisioningError,
  formatProvisioningFailure,
  resolveAuthToken,
} from "./provision-twilio-whatsapp-cli"

describe("Twilio provisioning CLI", () => {
  it("uses a hidden prompt in an interactive terminal", async () => {
    const prompt = vi.fn().mockResolvedValue("secret-token")
    const readPipedInput = vi.fn()

    await expect(
      resolveAuthToken({ interactive: true, prompt, readPipedInput })
    ).resolves.toBe("secret-token")
    expect(prompt).toHaveBeenCalledOnce()
    expect(readPipedInput).not.toHaveBeenCalled()
  })

  it("keeps piped input available for automation", async () => {
    const prompt = vi.fn()

    await expect(
      resolveAuthToken({
        interactive: false,
        prompt,
        readPipedInput: vi.fn().mockResolvedValue("piped-token\n"),
      })
    ).resolves.toBe("piped-token")
    expect(prompt).not.toHaveBeenCalled()
  })

  it("explains when the provider binding migration is missing", () => {
    const postgresError = Object.assign(new Error("relation does not exist"), {
      code: "42P01",
    })
    const queryError = new Error("Failed query: insert into ...", {
      cause: postgresError,
    })

    expect(formatProvisioningError(queryError)).toBe(
      "Database migrations are not up to date. Run `pnpm db:migrate` and try again."
    )
  })

  it("explains routing conflicts without printing the failed SQL", () => {
    const postgresError = Object.assign(new Error("duplicate key"), {
      code: "23505",
      constraint: "channel_connection_provider_bindings_routing_uidx",
    })
    const queryError = new Error("Failed query: insert into ...", {
      cause: postgresError,
    })

    expect(formatProvisioningError(queryError)).toBe(
      "This Twilio account and WhatsApp number are already connected to another Organization."
    )
  })

  it("does not mistake application error codes for Postgres errors", () => {
    const error = Object.assign(new Error("Unexpected positional argument"), {
      code: "ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL",
    })

    expect(formatProvisioningError(error)).toBe(
      "Unexpected positional argument"
    )
  })

  it("explains when Sandbox mode is required", () => {
    expect(
      formatProvisioningError(new TwilioConfigurationError("sender_not_found"))
    ).toBe(
      "The WhatsApp sender was not found in this Twilio Account. Use `--sandbox` for the Twilio Sandbox."
    )
  })

  it("renders a visible failure block", () => {
    expect(formatProvisioningFailure("Conflict", false)).toBe(
      "\nERROR: WhatsApp channel provisioning failed\n  Conflict\n\n"
    )
    expect(formatProvisioningFailure("Conflict", true)).toContain(
      "\u001B[1;31mERROR: WhatsApp channel provisioning failed\u001B[0m"
    )
  })
})
