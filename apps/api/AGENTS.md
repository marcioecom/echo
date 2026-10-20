# Echo API Agent Guide

Read the root `AGENTS.md` first. This file covers `apps/api` only.

## Stack

- Fastify 5 + Zod 4 (through `fastify-type-provider-zod`), Drizzle, Better Auth.
- Use `pnpm`. Write imports without file extensions.

## Module layout

```
src/modules/<feature>/
  http/routes.ts       # thin HTTP layer: schema + auth guard + result mapping
  schemas.ts           # Zod request schemas
  repositories/        # Drizzle access
  use-cases/           # business logic, one operation per file
  events/              # optional
  types.ts             # optional
```

Keep provider/SDK calls out of `http/`. Repositories, use-cases, and routes are separate layers.

## Routes

- Keep `http/routes.ts` thin: validate through the route `schema`, resolve auth, call one use-case, map the result to HTTP.
- Declare validation with Fastify route schemas; do not hand-roll `safeParse` checks:

  ```ts
  app.post(
    "/v1/things",
    { preHandler, schema: { body: createThingSchema } },
    async (request, reply) => {
      const auth = organizationAuth(request)
      // request.body is typed from the schema
    }
  )
  ```

  Validation failures are converted to `400 { error: "invalid_request" }` by the global handler in `app.ts`.
- Register routes on the `AppInstance` type from `@/lib/fastify`, which already carries `ZodTypeProvider`. Do not call `app.withTypeProvider(...)` inside a module.
- Map use-case results with `matchResult` / `matchTag` from `@/common/match`. Keep response status codes and `{ error: "..." }` codes stable.
- Do not put env checks or SDK construction in route files. Required env is validated at startup and dependencies are built once in the use-case module.

## Auth

- `guards.requireUser` → `401 unauthenticated`.
- `guards.requireMembership({ roles })` → `403 membership_required` / `insufficient_role`.
- `guards.requireOrganization({ roles })` is the standard guard for organization-scoped routes. It composes `requireUser` + `requireMembership` and can be passed directly as `preHandler`.
- `organizationAuth(request)` is the invariant accessor used inside handlers. It throws if the guard did not run, so always pair it with `requireOrganization`. Do not add `if (!auth.ok)` checks in routes.
- Auth-domain endpoints (`/api/auth/*`) go through `registerAuthRoutes`; on the web side use `authClient`. Do not create custom aggregation endpoints such as `/v1/me`.

## Use-cases

- One operation per file in `use-cases/`.
- Return `Result<T, { type: ... }>` from `@/common/result` for expected failures, or a tagged outcome union when it reads better. Routes translate the result; use-cases never touch `reply`.
- Organization checks, persistence orchestration, dispatch, and non-fatal cleanup belong here.
- Keep DTO serialization in one module per feature (for example `document-dto.ts`) and reuse it. Do not duplicate serializers in routes and use-cases.
- For side effects that should not fail the request (queue cleanup, deletion enqueue), log through the injected `FastifyBaseLogger`.

## Repositories

- Drizzle access lives in `repositories/`. Accept the DB via the constructor with `database.db` as the default so tests can inject one.
- Scope every query by `organizationId`.
- Make create operations retry-safe (for example `onConflictDoNothing` followed by a read) when a client can replay a request.

## Uploads (knowledge-base)

- The API never receives file bytes. It presigns a browser-to-R2 PUT and returns `{ uploadUrl, uploadToken, expiresAt, headers }`.
- The upload token is a stateless HMAC-signed payload (`upload-token.ts`). It binds upload id, organization, user, file metadata, object key, and expiry. `KNOWLEDGE_UPLOAD_TOKEN_SECRET` signs it; it must be at least 32 bytes and identical across API replicas.
- The presigned key is the permanent object key. On confirm, `verifyUploadedObject` only performs a `HEAD` (size, content type, etag). Do not add staging keys or server-side copies.

## Environment

- Env is validated in `config/env.ts`. Required variables must be required (fail fast), not feature-gated behind `503` responses.
- Keep `apps/api/.env.example` in sync.
- Do not read `process.env` outside `config/env.ts`.

## Tests

- Unit: `pnpm --filter @workspace/api test`.
- Integration: `pnpm --filter @workspace/api test:integration` (Docker/testcontainers).
- Mock external SDKs at the module boundary (`@langchain/openai`, `@/lib/object-store`, `@/lib/jobs-client`). Do not reintroduce injection-only modules just for tests.
- Stub every required env var with `vi.stubEnv` in integration suites.

## Formatting

- `pnpm --filter @workspace/api format` runs Prettier with import sorting.
- Import order is enforced: type imports, builtins, third-party (`@workspace/*`), `@/` aliases, then relative imports.
- Run `pnpm --filter @workspace/api lint` and `pnpm --filter @workspace/api typecheck` before finishing.
