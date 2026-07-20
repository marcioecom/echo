# Runtime Entrypoints And Auth CLI Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify the API and worker runtime entrypoints to `app.ts` + `main.ts`, make Redis roles explicit, and turn the Better Auth CLI config into a thin adapter with centralized env loading.

**Architecture:** Keep `app.ts` as the Fastify factory and move runtime lifecycle to `main.ts` for each app. Keep the API on one Redis dependency client, keep the worker on explicit dependency Redis plus BullMQ worker Redis, and reuse `createAuth(...)` from a renamed Better Auth CLI adapter.

**Tech Stack:** Fastify 5, Better Auth, BullMQ, ioredis, tsx, tsup, TypeScript, Vitest.

## Global Constraints

- Keep each runtime top-level shape to at most two files: `app.ts` and `main.ts`.
- Do not create a shared runtime/bootstrap package under `packages/*`.
- Keep `app.ts` pure and testable.
- Make the BullMQ Redis rule explicit where it is real.
- Remove loose `process.env` reads from the Better Auth CLI adapter.
- Preserve app-owned runtime wiring, focused packages, and no speculative cross-app runtime package.

---

### Task 1: Rename the runtime entrypoints and update scripts

**Files:**
- Create: `apps/api/src/main.ts`
- Create: `apps/worker/src/main.ts`
- Delete: `apps/api/src/index.ts`
- Delete: `apps/worker/src/index.ts`
- Modify: `apps/api/package.json`
- Modify: `apps/worker/package.json`

- [ ] Move API runtime lifecycle from `index.ts` to `main.ts`.
- [ ] Move worker runtime lifecycle from `index.ts` to `main.ts`.
- [ ] Update dev/start scripts to point to `main.ts` and `dist/main.js`.

### Task 2: Make Redis and shutdown roles explicit

**Files:**
- Modify: `apps/api/src/lib/redis.ts`
- Modify: `apps/worker/src/lib/redis.ts`
- Modify: `apps/api/src/main.ts`
- Modify: `apps/worker/src/main.ts`

- [ ] Replace generic Redis factory usage with role-named helpers or variables.
- [ ] Keep API on a single dependency Redis client.
- [ ] Keep worker on dependency Redis plus BullMQ worker Redis.
- [ ] Add a bounded shutdown timeout to the worker path.

### Task 3: Clean the Better Auth CLI adapter and remove redundant types

**Files:**
- Create: `apps/api/src/modules/auth/auth-cli-config.ts`
- Delete: `apps/api/src/modules/auth/auth-schema-config.ts`
- Modify: `apps/api/src/modules/auth/auth.ts`
- Modify: `apps/api/package.json`

- [ ] Rename the CLI config file to reflect its real role.
- [ ] Load env through `loadApiEnv()` in the CLI adapter.
- [ ] Remove local `InvitationEmailRequest` in favor of the domain job contract type.
- [ ] Point `auth:schema:generate` at the renamed adapter.

### Task 4: Verify runtime and auth surfaces still compile and test

**Files:**
- Verify existing tests and imports still work.

- [ ] Run API unit tests.
- [ ] Run worker unit tests.
- [ ] Run API typecheck.
- [ ] Run worker typecheck.
