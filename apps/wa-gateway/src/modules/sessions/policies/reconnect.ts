import type { CloseOutcome } from "../lifecycle"

export const MAX_RECONNECT_ATTEMPTS = 8

export function reconnectDelayMs(
  attempt: number,
  random: () => number = Math.random
): number {
  const base = Math.min(1_000 * 2 ** Math.max(0, attempt - 1), 5 * 60 * 1_000)
  return base + Math.floor(random() * 250)
}

export type ReconnectStep =
  | { type: "stop" }
  | { type: "exhausted"; attempt: number }
  | { type: "immediately"; attempt: number }
  | { type: "backoff"; attempt: number; delayMs: number }

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
  if (input.outcome === "restart" || input.outcome === "retry_after_open") {
    return { type: "immediately", attempt: 0 }
  }

  const attempt = input.attempt + 1
  if (attempt >= MAX_RECONNECT_ATTEMPTS) {
    return { type: "exhausted", attempt }
  }
  return {
    type: "backoff",
    attempt,
    delayMs: reconnectDelayMs(attempt, input.random),
  }
}
