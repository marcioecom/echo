import pino from "pino"

const baseLogger = pino({
  level: process.env.LOG_LEVEL || "info",
})

function createLoggerAdapter(pinoLogger: pino.Logger, context?: string) {
  return pinoLogger
}

export const logger = createLoggerAdapter(baseLogger)

export function createLoggerWithContext(context: string) {
  const child = baseLogger.child({ context })
  return createLoggerAdapter(child, context)
}
