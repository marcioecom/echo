import { DisconnectReason } from "@whiskeysockets/baileys"

// LEA-83 grows this table with alerts. The session loop only sees DisconnectAction.

export type DisconnectAction =
  | "restart"
  | "logged_out"
  | "replaced"
  | "banned"
  | "retry"

export function classifyDisconnect(
  statusCode: number | undefined
): DisconnectAction {
  if (statusCode === DisconnectReason.restartRequired) return "restart"
  if (statusCode === DisconnectReason.loggedOut) return "logged_out"
  if (statusCode === DisconnectReason.connectionReplaced) return "replaced"
  if (
    statusCode === DisconnectReason.forbidden ||
    statusCode === DisconnectReason.badSession
  ) {
    return "banned"
  }
  return "retry"
}

export function disconnectStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object" || !("output" in error)) {
    return undefined
  }
  const output = error.output
  if (!output || typeof output !== "object" || !("statusCode" in output)) {
    return undefined
  }
  return typeof output.statusCode === "number" ? output.statusCode : undefined
}
