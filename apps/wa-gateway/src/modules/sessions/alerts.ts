import type { SessionLogger } from "./types"

export const sessionAlertKinds = [
  "logged_out",
  "banned_suspected",
  "connection_replaced",
  "reconnect_exhausted",
] as const

export type SessionAlertKind = (typeof sessionAlertKinds)[number]

export interface SessionAlert {
  kind: SessionAlertKind
  organizationId: string
  channelConnectionId: string
  reason: string
}

// Operators grep this message. Sentry can ship the same structured log later.
export function emitSessionAlert(
  logger: SessionLogger,
  alert: SessionAlert
): void {
  logger.error("channel session alert", { ...alert })
}
