# Pino Logger Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide one contextual logger that supports message-first application calls and the complete Pino contract required by Fastify.

**Architecture:** `index.ts` owns the configured Pino instance and contextual child creation. `adapter.ts` wraps Pino with a `Proxy` that reverses message-first application calls only when the first argument is a string; native Pino calls pass through unchanged. The Pino Pretty message format renders the structured `context` field as a visible prefix in development.

**Tech Stack:** TypeScript, Pino 9, Pino Pretty 13, Fastify 5, Vitest 4.

## Global Constraints

- Use `pnpm` for all package commands.
- Keep `context` as a structured Pino binding in production JSON output.
- Render a present context as `[context] ` before the message in development pretty output.
- Preserve the full Pino API, including `child`, `trace`, `fatal`, level controls, and bindings.
- Support both `logger.info(message, data)` and native Pino `logger.info(data, message)` calls.
- Do not suppress Pino stream or transport errors.
- Do not alter unrelated uncommitted workspace changes.

---

## File Structure

- Create `packages/logger/src/adapter.ts`: defines the compatible adapter type and wraps Pino methods through a proxy.
- Create `packages/logger/src/adapter.test.ts`: verifies forwarding and recursive child adaptation against an in-memory Pino destination.
- Modify `packages/logger/src/index.ts`: removes the inline adapter, imports the extracted function, and configures context formatting.
- Modify `packages/logger/package.json`: adds the package-local Vitest test command and development dependency.
- Modify `apps/worker/src/app.ts`: passes the contextual logger through Fastify's `loggerInstance` option.

### Task 1: Add Adapter Contract Tests

**Files:**
- Create: `packages/logger/src/adapter.test.ts`
- Modify: `packages/logger/package.json`

**Interfaces:**
- Consumes: `createLoggerAdapter(logger: pino.Logger): LoggerAdapter` from `packages/logger/src/adapter.ts`.
- Produces: Tests that define the supported message-first/native-Pino behavior and require Fastify-compatible Pino members.

- [ ] **Step 1: Add the package-local test command and Vitest dependency**

Update `packages/logger/package.json`:

```json
{
  "scripts": {
    "test": "vitest run src"
  },
  "devDependencies": {
    "vitest": "^4.0.0"
  }
}
```

Preserve all existing script and dependency entries.

- [ ] **Step 2: Write the failing adapter tests**

Create `packages/logger/src/adapter.test.ts`:

```ts
import { Writable } from "node:stream"
import { describe, expect, it } from "vitest"
import pino from "pino"
import { createLoggerAdapter } from "./adapter"

function createCapturedLogger() {
  const entries: Record<string, unknown>[] = []
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      entries.push(JSON.parse(chunk.toString()))
      callback()
    },
  })

  return { entries, logger: pino(destination) }
}

describe("createLoggerAdapter", () => {
  it("forwards message-first calls using Pino's native argument order", () => {
    const { entries, logger } = createCapturedLogger()

    createLoggerAdapter(logger).info("Job completed", { jobId: "job_123" })

    expect(entries).toContainEqual(
      expect.objectContaining({ msg: "Job completed", jobId: "job_123" }),
    )
  })

  it("preserves native Pino object-first calls", () => {
    const { entries, logger } = createCapturedLogger()

    createLoggerAdapter(logger).info({ requestId: "req_123" }, "Request received")

    expect(entries).toContainEqual(
      expect.objectContaining({ msg: "Request received", requestId: "req_123" }),
    )
  })

  it("adapts child loggers while preserving Pino bindings", () => {
    const { entries, logger } = createCapturedLogger()

    createLoggerAdapter(logger).child({ context: "worker:registry" }).info(
      "Registered processors",
      { processors: ["send-invitation-email"] },
    )

    expect(entries).toContainEqual(
      expect.objectContaining({
        context: "worker:registry",
        msg: "Registered processors",
        processors: ["send-invitation-email"],
      }),
    )
  })
})
```

- [ ] **Step 3: Run the focused tests to verify they fail**

Run: `pnpm --filter @workspace/logger test`

Expected: FAIL because `createLoggerAdapter` is not exported from `packages/logger/src/adapter.ts`.

### Task 2: Implement the Pino-Compatible Adapter

**Files:**
- Create: `packages/logger/src/adapter.ts`
- Test: `packages/logger/src/adapter.test.ts`

**Interfaces:**
- Consumes: a complete `pino.Logger`.
- Produces: `createLoggerAdapter(pinoLogger: pino.Logger): LoggerAdapter`, assignable to a `pino.Logger` and supporting message-first level calls.

- [ ] **Step 1: Define the adapter type and proxy implementation**

Replace `packages/logger/src/adapter.ts` with:

```ts
import pino from "pino"

const levelMethods = new Set([
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

type AdaptedLogMethod = pino.LogFn & MessageFirstLog

export type LoggerAdapter = Omit<
  pino.Logger,
  "trace" | "debug" | "info" | "warn" | "error" | "fatal" | "child"
> & {
  trace: AdaptedLogMethod
  debug: AdaptedLogMethod
  info: AdaptedLogMethod
  warn: AdaptedLogMethod
  error: AdaptedLogMethod
  fatal: AdaptedLogMethod
  child: (...args: Parameters<pino.Logger["child"]>) => LoggerAdapter
}

export function createLoggerAdapter(pinoLogger: pino.Logger): LoggerAdapter {
  return new Proxy(pinoLogger, {
    get(target, property) {
      if (property === "child") {
        return (...args: Parameters<pino.Logger["child"]>) =>
          createLoggerAdapter(target.child(...args))
      }

      const value = Reflect.get(target, property, target)

      if (typeof property === "string" && levelMethods.has(property)) {
        return (...args: unknown[]) => {
          if (typeof args[0] === "string" && args.length > 1) {
            const [message, data, ...rest] = args
            return (value as (...arguments_: unknown[]) => void).call(
              target,
              data,
              message,
              ...rest,
            )
          }

          return (value as (...arguments_: unknown[]) => void).apply(target, args)
        }
      }

      return typeof value === "function" ? value.bind(target) : value
    },
  }) as LoggerAdapter
}
```

- [ ] **Step 2: Run the focused tests to verify they pass**

Run: `pnpm --filter @workspace/logger test`

Expected: PASS with three adapter tests.

- [ ] **Step 3: Run package typecheck**

Run: `pnpm --filter @workspace/logger typecheck`

Expected: PASS with no TypeScript errors.

### Task 3: Wire the Adapter and Fastify

**Files:**
- Modify: `packages/logger/src/index.ts:1-113`
- Modify: `apps/worker/src/app.ts:1-21`
- Test: `packages/logger/src/adapter.test.ts`

**Interfaces:**
- Consumes: `createLoggerAdapter` from `packages/logger/src/adapter.ts`.
- Produces: `createLoggerWithContext(context: string): LoggerAdapter` for application modules and Fastify's `loggerInstance` option.

- [ ] **Step 1: Extract the existing inline adapter from `index.ts`**

Replace the inline `createLoggerAdapter` function in `packages/logger/src/index.ts` with:

```ts
import pino from "pino"
import { createLoggerAdapter } from "./adapter"
```

Keep the existing Pino serializers and transport configuration. In the `pino-pretty`
options, replace the existing `messageFormat` entry with:

```ts
messageFormat: "{if context}[{context}] {end}{msg}",
```

Keep the exports in this form:

```ts
export const logger = createLoggerAdapter(baseLogger)

export function createLoggerWithContext(context: string) {
  return createLoggerAdapter(baseLogger.child({ context }))
}
```

- [ ] **Step 2: Pass the contextual logger to Fastify**

In `apps/worker/src/app.ts`, replace the inline Fastify logger options with the logger
created on the preceding line:

```ts
const logger = createLoggerWithContext("worker:api")
const app = Fastify({ loggerInstance: logger })
```

Remove the now-unused `env` import only if it is no longer used elsewhere in the file.

- [ ] **Step 3: Run the focused verification commands**

Run: `pnpm --filter @workspace/logger test`

Expected: PASS with the adapter tests.

Run: `pnpm --filter @workspace/logger typecheck`

Expected: PASS with no TypeScript errors.

Run: `pnpm --filter @workspace/worker typecheck`

Expected: PASS, confirming Fastify accepts `LoggerAdapter` through `loggerInstance`.

- [ ] **Step 4: Run the relevant lint commands**

Run: `pnpm --filter @workspace/logger lint`

Expected: PASS with no lint warnings.

Run: `pnpm --filter @workspace/worker lint`

Expected: PASS with no lint warnings.

## Plan Self-Review

- Spec coverage: Tasks 1 and 2 implement message-first and native Pino forwarding plus adapted children. Task 3 preserves structured context, applies the requested pretty format, and verifies Fastify compatibility.
- Placeholder scan: no unresolved implementation steps or unspecified interfaces remain.
- Type consistency: `createLoggerAdapter` and `LoggerAdapter` have the same names and signatures across tests, implementation, and wiring.
