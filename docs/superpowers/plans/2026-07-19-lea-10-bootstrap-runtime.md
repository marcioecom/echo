# LEA-10: Bootstrap the WhatsApp-first monorepo runtime

## Goal

Establish the runnable monorepo foundation for Echo with separate web, API, and worker runtimes; tenant-aware persistence; validated Postgres and Redis connectivity; and a reproducible local development workflow.

## Implementation sequence

1. Add `packages/domain` for canonical status/channel schemas and shared monotonic ULID generation.
2. Add `packages/config` for common server env validation while keeping `.env` files app-local.
3. Add `packages/db` with a node-postgres pool, Drizzle client, generated Better Auth schema, support schema, committed migration, and tenant integrity constraints.
4. Configure Better Auth Organizations in `apps/api` only far enough to generate the canonical auth schema. Defer routes, sessions, login, memberships, roles, and invites to LEA-11.
5. Add `apps/api` as a Fastify runtime with fail-fast startup validation, structured logging, liveness/readiness, and graceful shutdown.
6. Add `apps/worker` with the same operational lifecycle plus a BullMQ worker registry ready for the first real job. Do not create sample or smoke jobs.
7. Add Compose-managed Postgres and Redis, app-local env examples, root scripts, and an executable setup README.
8. Verify domain/config units, health contracts, real migrations, cross-tenant constraints, active Conversation uniqueness, immutable Audit Events, production builds, and live probes.

## Data model

The initial migration includes Better Auth's auth/Organization tables and these support tables:

- `channel_connections`
- `contacts`
- `channel_identities`
- `support_conversations`
- `messages`
- `audit_events`

Every support-core table carries `organization_id`. Composite foreign keys prevent cross-tenant relationships. A partial unique index permits only one unresolved Support Conversation for each Organization, Channel Identity, and Channel Connection tuple.

## Acceptance mapping

- `apps/api` and `apps/worker`: independent TypeScript/Node runtimes coordinated by Turbo alongside `apps/web`.
- Postgres and Redis wiring: startup validation plus `/health/live` and `/health/ready` in API and worker.
- Tenant-aware schema: committed Drizzle migration with Organizations and all required support entities.
- Local end-to-end verification: Compose boot, migration, production build, real dependency integration tests, and documented probe commands.

## Out of scope

- Better Auth routes and user-facing auth flows
- Twilio credentials or provider-specific Channel Connection storage
- WhatsApp webhook ingestion
- Real BullMQ jobs
- Support Inbox behavior
- LangGraph orchestration
- CI workflow
