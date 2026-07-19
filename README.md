# Echo

Echo is a tenant-aware, WhatsApp-first support platform. The monorepo contains:

- `apps/web`: Next.js operator interface
- `apps/api`: Fastify API and future Better Auth host
- `apps/worker`: background processing runtime
- `packages/domain`: shared domain contracts and ULID generation
- `packages/db`: Drizzle schema, migrations, and Postgres client
- `packages/config`: shared server environment validation

## Prerequisites

- Node.js 20 or newer
- pnpm 10.33.4
- Docker with Compose

## Local setup

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/worker/.env.example apps/worker/.env
pnpm infra:up
pnpm db:migrate
pnpm dev
```

The local services use these addresses:

| Service | Address |
| --- | --- |
| Web | http://localhost:3000 |
| API | http://localhost:3001 |
| Worker health | http://localhost:3002 |
| Postgres | localhost:5432 |
| Redis | localhost:6379 |

## Verify connectivity

Both server runtimes fail during startup if Postgres or Redis is unavailable. Once `pnpm dev` is running, verify their probes:

```bash
curl --fail http://localhost:3001/health/live
curl --fail http://localhost:3001/health/ready
curl --fail http://localhost:3002/health/live
curl --fail http://localhost:3002/health/ready
```

Readiness returns HTTP 503 when either dependency is unavailable. Responses expose only sanitized dependency states.

## Database workflow

The Better Auth schema is generated from the API-owned auth configuration. Domain tables are maintained separately in `packages/db/src/schema/support.ts`.

```bash
pnpm auth:schema:generate
pnpm db:generate
pnpm db:migrate
pnpm db:studio
```

Commit generated SQL migrations. Do not use `drizzle-kit push` as the normal schema workflow.
Database commands load `apps/api/.env`, the app-local environment owned by the API. The same commands can be run from `packages/db` as `pnpm db:generate`, `pnpm db:migrate`, and `pnpm db:studio`.

## Quality checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
```

Integration tests start isolated Postgres and Redis containers and do not modify the local development database.

## Stop local infrastructure

```bash
pnpm infra:down
```
