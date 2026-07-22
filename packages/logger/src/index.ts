import pino from "pino"
import { createLoggerAdapter } from "./adapter"

export * from "./adapter"

const isPretty =
  process.env.LOG_PRETTY === "true" || process.env.NODE_ENV === "development"

const baseLogger = pino({
  level: process.env.LOG_LEVEL || "info",
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
  },
  // Use pretty printing in development, structured JSON in production
  ...(isPretty && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss",
        ignore: "pid,hostname,context",
        messageFormat: "{if context}[{context}] {end}{msg}",
        hideObject: false,
        singleLine: false,
        useLevelLabels: true,
        levelFirst: true,
      },
    },
  }),
})

export const logger = createLoggerAdapter(baseLogger)

export function createLoggerWithContext(context: string) {
  return createLoggerAdapter(baseLogger.child({ context }))
}
