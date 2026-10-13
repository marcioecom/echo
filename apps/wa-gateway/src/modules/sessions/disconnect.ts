import { DisconnectReason } from "@whiskeysockets/baileys"

// Baileys 7.0.0-rc14. connectionLost and timedOut are both 408.
export type DisconnectAction =
  | "restart"
  | "logged_out"
  | "replaced"
  | "banned"
  | "retry"

export function classifyDisconnect(
  statusCode: number | undefined
): DisconnectAction {
  switch (statusCode) {
    case DisconnectReason.restartRequired:
      return "restart"
    case DisconnectReason.loggedOut:
      return "logged_out"
    case DisconnectReason.connectionReplaced:
      return "replaced"
    case DisconnectReason.forbidden:
    case DisconnectReason.badSession:
      return "banned"
    case DisconnectReason.connectionClosed:
    case DisconnectReason.connectionLost:
    case DisconnectReason.unavailableService:
    case DisconnectReason.multideviceMismatch:
      return "retry"
    default:
      return "retry"
  }
}

export function disconnectError(statusCode: number | undefined): string {
  switch (statusCode) {
    case DisconnectReason.connectionClosed:
      return "connection_closed"
    case DisconnectReason.unavailableService:
      return "unavailable_service"
    case DisconnectReason.multideviceMismatch:
      return "multidevice_mismatch"
    case DisconnectReason.badSession:
      return "bad_session"
    case DisconnectReason.forbidden:
      return "forbidden"
    case DisconnectReason.connectionReplaced:
      return "connection_replaced"
    case DisconnectReason.loggedOut:
      return "logged_out"
    default:
      return "connection_lost"
  }
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
