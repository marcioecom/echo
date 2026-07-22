import pino from "pino"

type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal"

const levelMethods = new Set<LogLevel>([
  "trace",
  "debug",
  "info",
  "warn",
  "error",
  "fatal",
])

type MessageFirstLog = {
  (message: string): void
  (message: string, data: object): void
}

type AdaptedLogMethod = MessageFirstLog & pino.LogFn

function isLogLevel(property: PropertyKey): property is LogLevel {
  return typeof property === "string" && levelMethods.has(property as LogLevel)
}

function adaptLogMethod<CustomLevels extends string>(
  logger: pino.Logger<CustomLevels>,
  method: pino.LogFn
) {
  const log = method as (...arguments_: unknown[]) => void

  return (...args: unknown[]) => {
    if (typeof args[0] === "string" && args.length > 1) {
      const [message, data, ...rest] = args
      log.call(logger, data, message, ...rest)
      return
    }

    log.apply(logger, args)
  }
}

export type LoggerAdapter<CustomLevels extends string = never> = Omit<
  pino.BaseLogger,
  "trace" | "debug" | "info" | "warn" | "error" | "fatal"
> &
  Omit<pino.LoggerExtras<CustomLevels>, "child"> & {
  trace: AdaptedLogMethod
  debug: AdaptedLogMethod
  info: AdaptedLogMethod
  warn: AdaptedLogMethod
  error: AdaptedLogMethod
  fatal: AdaptedLogMethod
  child: <ChildCustomLevels extends string = never>(
    bindings: pino.Bindings,
    options?: pino.ChildLoggerOptions<ChildCustomLevels>
  ) => LoggerAdapter<CustomLevels | ChildCustomLevels>
}

export function createLoggerAdapter<CustomLevels extends string = LogLevel>(
  pinoLogger: pino.Logger<CustomLevels>
): LoggerAdapter<CustomLevels> {
  return new Proxy(pinoLogger, {
    get(target, property) {
      if (property === "child") {
        return <ChildCustomLevels extends string = never>(
          bindings: pino.Bindings,
          options?: pino.ChildLoggerOptions<ChildCustomLevels>
        ) => createLoggerAdapter(target.child(bindings, options))
      }

      const value = Reflect.get(target, property, target)

      if (isLogLevel(property)) {
        return adaptLogMethod(target, value as pino.LogFn)
      }

      return typeof value === "function" ? value.bind(target) : value
    },
  }) as LoggerAdapter<CustomLevels>
}
