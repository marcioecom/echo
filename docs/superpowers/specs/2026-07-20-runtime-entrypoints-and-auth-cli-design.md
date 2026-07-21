# Runtime Entrypoints And Auth CLI Cleanup Design

## Status

Approved in conversation on 2026-07-20.

## Context

Echo currently has the right high-level split between Fastify app construction and runtime boot, but the runtime entrypoints have accumulated too much lifecycle detail in one place:

- `apps/api/src/index.ts` owns env loading, Postgres boot, Redis boot, BullMQ producer boot, Better Auth wiring, HTTP listen, and graceful shutdown.
- `apps/worker/src/index.ts` owns env loading, Postgres boot, two Redis concerns, BullMQ worker wiring, HTTP listen, and graceful shutdown.
- `apps/api/src/modules/auth/auth-schema-config.ts` exists only for the Better Auth CLI, but currently reads `process.env` directly with fallback values, which breaks the project's documented rule against loose env access.

The user wants cleaner, more intentional runtime organization that preserves locality without introducing extra top-level files or speculative shared runtime abstractions.

## Goals

- Keep each runtime top-level shape to at most two files: `app.ts` and `main.ts`.
- Make runtime lifecycle easy to read linearly: env -> dependencies -> app -> listen -> shutdown.
- Keep `app.ts` pure and testable.
- Make the BullMQ Redis rule explicit where it is real.
- Remove loose `process.env` reads from the Better Auth CLI adapter.
- Preserve the AI code design guide: app-owned runtime wiring, focused packages, no speculative cross-app runtime package.

## Non-goals

- Do not create a shared runtime/bootstrap package under `packages/*`.
- Do not redesign feature module boundaries in `modules/*`.
- Do not add heavy queue registries, processor registries, telemetry, or admin dashboards inspired by larger workers.
- Do not collapse everything into a single `app.ts` file.

## Reference Readings And Takeaways

### Rocketseat Fastify examples

Files reviewed:

- `~/code/marcioecom/rocketseat/nodejs/nlw-expert-nodejs/src/http/server.ts`
- `~/code/marcioecom/rocketseat/nodejs/nlw-journey-nodejs/src/server.ts`
- `~/code/marcioecom/rocketseat/nodejs/nlw-unite-nodejs/src/server.ts`

Useful takeaway:

- Their entrypoints feel clean because they do very little: create the app, register plugins and routes, and listen.

Rejected takeaway:

- Their lifecycle is too small for Echo. They do not boot or close Postgres, Redis, BullMQ, Better Auth, or background workers.

### Midday worker

File reviewed:

- `/Users/marciojunior/code/leapstark/midday-clone/apps/worker/src/index.ts`

Useful takeaway:

- Keep the runtime entrypoint thin by pushing business logic elsewhere.
- Make shutdown order explicit.
- Keep lifecycle ownership visible in one file.

Rejected takeaway:

- Midday's registries, schedulers, instrumentation, and operational surface are too heavy for Echo right now.

### Fastify and BullMQ docs

Relevant guidance:

- `fastify.close()` is the correct HTTP server shutdown seam. During close, new requests receive `503` by default.
- `worker.close()` is the correct BullMQ graceful shutdown seam. It waits for in-flight jobs and does not impose its own timeout.
- BullMQ `Worker` connections require `maxRetriesPerRequest: null` when using `ioredis`.
- BullMQ producer-style `Queue` usage in an HTTP app should fail fast rather than wait forever on Redis retries.

## Final Shape

Each runtime has exactly two top-level files:

- `app.ts`
- `main.ts`

There is no `index.ts` and no `bootstrap.ts`.

## Runtime Responsibilities

### `app.ts`

`app.ts` is the Fastify factory module.

It owns:

- creating the Fastify instance
- logger configuration for that runtime
- registering plugins and HTTP routes
- accepting already-created dependencies as arguments

It does not own:

- `process` signal handling
- env loading
- dependency creation
- listen/startup
- shutdown ordering

This keeps `app.ts` small, deterministic, and directly testable.

### `main.ts`

`main.ts` is the only runtime entrypoint.

It owns:

- loading env
- creating infrastructure dependencies
- wiring adapters into the app factory
- readiness preflight checks
- starting the HTTP server
- registering `SIGINT` and `SIGTERM`
- graceful shutdown ordering
- fatal startup error handling

This keeps the lifecycle readable as one linear flow.

## API Runtime Design

`apps/api/src/main.ts` will own this sequence:

1. Load env with `loadApiEnv()`.
2. Create the database dependency.
3. Create one dependency Redis client for readiness checks and BullMQ producer usage.
4. Create the email queue adapter.
5. Create the Better Auth instance.
6. Create the Fastify app by calling `createApp(env, dependencies)`.
7. Perform preflight dependency checks before listening.
8. Start listening.
9. Register graceful shutdown.

### API Redis rule

The API keeps one Redis client.

Reason:

- The API is a producer runtime triggered by HTTP requests.
- BullMQ docs recommend that producer-style HTTP flows fail fast instead of waiting forever.
- The worker-only requirement for `maxRetriesPerRequest: null` does not apply here.

This intentionally rejects artificial symmetry with the worker.

### API shutdown order

The API shutdown path is:

1. `app.close()`
2. `emailQueue.close()`
3. `redis.quit()`
4. `database.close()`

The shutdown guard remains re-entrant.

## Worker Runtime Design

`apps/worker/src/main.ts` will own this sequence:

1. Load env with `loadWorkerEnv()`.
2. Create the database dependency.
3. Create one Redis client for readiness checks.
4. Create one BullMQ worker connection with `maxRetriesPerRequest: null`.
5. Create and register workers.
6. Create the Fastify app by calling `createApp(env, dependencies)`.
7. Perform preflight dependency checks before listening.
8. Start listening.
9. Register graceful shutdown.

### Worker Redis rule

The worker keeps two Redis concerns and names them by role, not generic technology:

- dependency Redis
- worker Redis connection

Reason:

- the dependency Redis client is for readiness and fail-fast checks
- the BullMQ worker connection is a long-lived background consumer connection with different retry semantics

This is the one place where the two-Redis rule is real and should stay visible.

### Worker shutdown order

The worker shutdown path is:

1. `app.close()`
2. `workers.close()`
3. `workerRedis.quit()`
4. `redis.quit()`
5. `database.close()`

The worker shutdown path includes a timeout wrapper because `worker.close()` has no built-in timeout and may wait for in-flight jobs.

## Naming Rules For Runtime Dependencies

Inline names like `redis` and `queueConnection` are too generic for lifecycle code.

Runtime dependencies should be named by operational role, for example:

- `redis`
- `workerRedisConnection`
- `emailQueue`
- `workers`

Redis creation helpers should also be named by role instead of generic transport-only terms.

The point is not to create a runtime framework. The point is to make the lifecycle file self-explanatory.

## Better Auth CLI Adapter Design

The Better Auth CLI still needs a config file path. That file remains, but it is no longer treated like a runtime entrypoint.

### Decision

- Rename `apps/api/src/modules/auth/auth-schema-config.ts` to `apps/api/src/modules/auth/auth-cli-config.ts`.

### Responsibilities

The CLI adapter does exactly four things:

1. load env through `loadApiEnv()`
2. create the database with runtime-approved env values
3. create the Better Auth instance through the same `createAuth(...)`
4. inject `deliverInvitationEmail: async () => undefined`

### Constraints

- No direct `process.env` reads in the file.
- No hardcoded fallback URLs or secrets.
- The command environment must provide the needed values, including loading `.env` for the CLI process.

This turns the file into a thin adapter instead of a second config system.

## Script Changes

The API runtime script names should reflect the new entrypoint:

- dev script points to `src/main.ts`
- build output start script points to `dist/main.js`

The Better Auth generation script continues to use `auth generate --config ...`, but now points to the renamed CLI adapter and runs with the app env loaded into the process.

## Testing Impact

This refactor should preserve the current test surface:

- `createApp(...)` remains importable for direct API and worker tests.
- integration tests do not need to cross process boundaries to test runtime composition.
- runtime-specific lifecycle behavior can be tested more narrowly through `main.ts` dependencies if needed later.

No new test framework is required for this cleanup.

## Rejected Alternatives

### `bootstrap.ts`

Rejected because it adds a third top-level runtime file without buying enough depth.

### Single-file `app.ts`

Rejected because it mixes Fastify construction with lifecycle and process ownership, reducing locality and testability.

### Shared runtime package

Rejected because it would centralize app-local lifecycle concerns too early and violate the current package discipline.

## Expected Outcome

After the cleanup:

- the top of each runtime is only `app.ts` + `main.ts`
- lifecycle reads cleanly and predictably
- the worker's BullMQ-specific Redis rule is explicit
- the API does not pretend to have the same Redis lifecycle as the worker when it does not
- Better Auth schema generation uses the same env pathway as the runtime
- `auth-cli-config.ts` is obviously a CLI adapter rather than a mysterious second entrypoint
