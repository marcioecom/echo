import { reconnectDelayMs } from "./pacing"

export const MAX_RECONNECT_ATTEMPTS = 10

export type CloseOutcome =
  | "restart"
  | "logged_out"
  | "replaced"
  | "banned"
  | "retry"
  | "retry_after_open"
  | "pairing_timeout"
  | "stopped"

export type ReconnectStep =
  | { type: "stop" }
  | { type: "exhausted"; attempt: number }
  | { type: "immediately"; attempt: number }
  | { type: "backoff"; attempt: number; delayMs: number }

// restartRequired reconnects immediately. A dropped socket backs off.
// Logout, replacement, ban, and the attempt cap stop the loop.
export function nextReconnect(input: {
  outcome: CloseOutcome
  attempt: number
  stopped: boolean
  random?: () => number
}): ReconnectStep {
  if (input.stopped || input.outcome === "stopped") return { type: "stop" }
  if (
    input.outcome === "logged_out" ||
    input.outcome === "replaced" ||
    input.outcome === "banned" ||
    input.outcome === "pairing_timeout"
  ) {
    return { type: "stop" }
  }
  if (input.outcome === "restart") {
    return { type: "immediately", attempt: 0 }
  }

  const attempt = input.outcome === "retry_after_open" ? 1 : input.attempt + 1
  if (attempt >= MAX_RECONNECT_ATTEMPTS) {
    return { type: "exhausted", attempt }
  }
  return {
    type: "backoff",
    attempt,
    delayMs: reconnectDelayMs(attempt, input.random),
  }
}
