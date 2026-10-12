# Pino Logger Adapter Design

Date: 2026-07-21
Status: Approved for implementation

## Goal

Expose one contextual logger that works in application code and as a Fastify logger.

Application code uses message-first calls:

```ts
const logger = createLoggerWithContext("worker:queue:email")
logger.info("Job completed", { jobName: job.name, jobId: job.id })
```

Fastify receives that same logger instance through `loggerInstance`; Fastify 5
reserves `logger` for a configuration object:

```ts
Fastify({ loggerInstance: createLoggerWithContext("worker:api") })
```

## Design

`packages/logger/src/index.ts` owns Pino configuration and creates child loggers with
the structured `context` binding. It exports `logger` and `createLoggerWithContext`.

`packages/logger/src/adapter.ts` exports `createLoggerAdapter`. The adapter wraps a
`pino.Logger` with a proxy that preserves the full Pino surface required by Fastify.

For the six Pino level methods (`trace`, `debug`, `info`, `warn`, `error`, and
`fatal`), the adapter supports both call conventions:

- Application convention: `logger.info(message, data)`.
- Native Pino convention: `logger.info(data, message)`.

The adapter detects a string first argument and forwards the arguments to Pino in its
native message/object order. Non-string first arguments pass through untouched, so
Fastify request and response logging remains correct. `child()` wraps its result in a
new adapter so contextual child loggers remain compatible with both APIs.

All other Pino members remain available through the proxy, including level controls,
bindings, serializers, and custom Pino methods.

## Formatting

`context` remains a structured Pino field. In JSON output it is queryable as
`context`. Development pretty output uses Pino Pretty's message format to render it
ahead of the message:

```text
INFO [14:38:06]: [worker:registry] Registered processors {"processors":["send-invitation-email"]}
```

The message itself is not mutated with a context prefix. This avoids duplicated
context while keeping production logs structured.

Pretty output keeps ordinary log metadata on one line across runtimes. Error
stacks remain multiline for diagnosis. Production keeps structured JSON unless
`LOG_PRETTY=true` is explicitly enabled.

The API emits one HTTP summary on completion: `reqId`, method, path without query
parameters, status code, and duration in milliseconds. Successful requests use
`debug` in development and `info` elsewhere; 4xx responses use `warn`, and 5xx
responses use `error`, including the error and stack when available. Set
`LOG_LEVEL=debug` in `apps/api/.env` to see successful local requests.

Request/response serializers retain only method, query-free path, and status.
Headers (including cookies and authorization), query objects, and bodies are not
included in HTTP summaries or serialized request/response objects.

## Error Handling

The adapter does not suppress stream errors. Pino owns stream and transport error
handling, and silently dropping logging failures hides operational faults.

## Verification

- Package typecheck verifies the adapter remains assignable where Fastify expects a
  Pino-compatible logger.
- Focused unit tests verify message-first forwarding, native Pino forwarding, child
  adaptation, and the configured context binding.
- Worker typecheck verifies `Fastify({ logger })` accepts the contextual logger.
