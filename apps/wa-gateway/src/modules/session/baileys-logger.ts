import pino from "pino"

const redactedKeys = new Set(["qr", "pairingCode", "authToken"])

export interface BaileysLogger {
  level: string
  child(obj: Record<string, unknown>): BaileysLogger
  trace(obj: unknown, msg?: string): void
  debug(obj: unknown, msg?: string): void
  info(obj: unknown, msg?: string): void
  warn(obj: unknown, msg?: string): void
  error(obj: unknown, msg?: string): void
}

export function createBaileysLogger(
  destination?: pino.DestinationStream
): BaileysLogger {
  const logger = destination
    ? pino({ level: "warn" }, destination)
    : pino({ level: "warn" })
  return wrap(logger)
}

function wrap(logger: pino.Logger): BaileysLogger {
  const write = (method: "warn" | "error") => (obj: unknown, msg?: string) => {
    const redacted = redact(obj)
    if (typeof msg === "string") logger[method](redacted, msg)
    else logger[method](redacted)
  }

  const baileysLogger: BaileysLogger = {
    level: "warn",
    child: () => baileysLogger,
    trace: () => undefined,
    debug: () => undefined,
    info: () => undefined,
    warn: write("warn"),
    error: write("error"),
  }
  return baileysLogger
}

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => redact(entry))
  if (!value || typeof value !== "object") return value
  const copy: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value)) {
    copy[key] = redactedKeys.has(key) ? "[redacted]" : redact(entry)
  }
  return copy
}
