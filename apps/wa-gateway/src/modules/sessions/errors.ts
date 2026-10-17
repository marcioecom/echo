export class SessionUnavailableError extends Error {
  constructor() {
    super("session_unavailable")
    this.name = "SessionUnavailableError"
  }
}

export class PairingUnavailableError extends Error {
  constructor() {
    super("pairing_unavailable")
    this.name = "PairingUnavailableError"
  }
}

export class RoutingConflictError extends Error {
  constructor() {
    super("Channel routing key is already in use")
    this.name = "RoutingConflictError"
  }
}
