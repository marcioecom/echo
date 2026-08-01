import { TwilioConfigurationError } from "../adapters/twilio-channel-provider"

interface AuthTokenInput {
  interactive: boolean
  prompt: () => Promise<string>
  readPipedInput: () => Promise<string>
}

interface PostgresError {
  code?: string
  constraint?: string
  cause?: unknown
}

function requireAuthToken(value: string): string {
  const token = value.trim()
  if (!token) {
    throw new Error("Twilio Auth Token is required")
  }
  return token
}

export async function resolveAuthToken(input: AuthTokenInput): Promise<string> {
  const value = input.interactive
    ? await input.prompt()
    : await input.readPipedInput()
  return requireAuthToken(value)
}

function findPostgresError(error: unknown): PostgresError | null {
  const visited = new Set<unknown>()
  let current = error

  while (typeof current === "object" && current !== null) {
    if (visited.has(current)) {
      return null
    }
    visited.add(current)

    const candidate = current as PostgresError
    if (
      typeof candidate.code === "string" &&
      /^[0-9A-Z]{5}$/.test(candidate.code)
    ) {
      return candidate
    }
    current = candidate.cause
  }

  return null
}

export function formatProvisioningError(error: unknown): string {
  if (error instanceof TwilioConfigurationError) {
    const messages: Record<TwilioConfigurationError["reason"], string> = {
      provider_request_failed:
        "Twilio credentials could not be verified for this Account SID.",
      sender_not_found:
        "The WhatsApp sender was not found in this Twilio Account. Use `--sandbox` for the Twilio Sandbox.",
      sender_not_online: "The Twilio WhatsApp sender is not online.",
      invalid_sandbox_address:
        "The Twilio Sandbox must use the shared number +14155238886.",
      account_not_active: "The Twilio Account is not active.",
    }
    return messages[error.reason]
  }

  const postgresError = findPostgresError(error)
  if (postgresError?.code === "42P01") {
    return "Database migrations are not up to date. Run `pnpm db:migrate` and try again."
  }
  if (
    postgresError?.code === "23505" &&
    postgresError.constraint ===
      "channel_connection_provider_bindings_routing_uidx"
  ) {
    return "This Twilio account and WhatsApp number are already connected to another Organization."
  }
  if (postgresError) {
    return `Database rejected the provisioning operation (Postgres ${postgresError.code}).`
  }

  return error instanceof Error ? error.message : "Provisioning failed"
}

export function formatProvisioningFailure(
  message: string,
  color: boolean
): string {
  const title = "ERROR: WhatsApp channel provisioning failed"
  const visibleTitle = color ? `\u001B[1;31m${title}\u001B[0m` : title
  return `\n${visibleTitle}\n  ${message}\n\n`
}
