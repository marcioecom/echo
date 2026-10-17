export type CloseOutcome =
  | "restart"
  | "logged_out"
  | "replaced"
  | "banned"
  | "retry"
  | "retry_after_open"
  | "pairing_timeout"
  | "stopped"

type RetryOutcome = Extract<
  CloseOutcome,
  "restart" | "retry" | "retry_after_open"
>

export type LifecycleState =
  | { phase: "unowned" }
  | { phase: "connecting" }
  | { phase: "pairing"; qrSeen: true }
  | { phase: "connected" }
  | { phase: "backoff"; attempt: number; delayMs: number; outcome: RetryOutcome }
  | { phase: "stopping" }
  | { phase: "stopped" }

export type LifecycleEvent =
  | { type: "connect" }
  | { type: "qr" }
  | { type: "open" }
  | { type: "close"; outcome: CloseOutcome }
  | { type: "backoff"; attempt: number; delayMs: number }
  | { type: "stop" }
  | { type: "stopped" }

export function transitionLifecycle(
  state: LifecycleState,
  event: LifecycleEvent
): LifecycleState {
  if (state.phase === "stopped" || state.phase === "stopping") {
    return event.type === "stopped" ? { phase: "stopped" } : state
  }
  if (event.type === "stop") return { phase: "stopping" }
  if (event.type === "stopped") return { phase: "stopped" }

  switch (event.type) {
    case "connect":
      return { phase: "connecting" }
    case "qr":
      return { phase: "pairing", qrSeen: true }
    case "open":
      return { phase: "connected" }
    case "close":
      switch (event.outcome) {
        case "logged_out":
        case "replaced":
        case "banned":
        case "pairing_timeout":
        case "stopped":
          return { phase: "stopped" }
        case "restart":
        case "retry":
        case "retry_after_open":
          return {
            phase: "backoff",
            attempt: 0,
            delayMs: 0,
            outcome: event.outcome,
          }
        default: {
          const exhaustive: never = event.outcome
          return exhaustive
        }
      }
    case "backoff":
      return state.phase === "backoff"
        ? { ...state, attempt: event.attempt, delayMs: event.delayMs }
        : state
    default: {
      const exhaustive: never = event
      return exhaustive
    }
  }
}
