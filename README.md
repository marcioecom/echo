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

| Service       | Address               |
| ------------- | --------------------- |
| Web           | http://localhost:3000 |
| API           | http://localhost:3001 |
| Worker health | http://localhost:3002 |
| Postgres      | localhost:5432        |
| Redis         | localhost:6379        |

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

## Provision a WhatsApp Channel Connection

The initial onboarding flow uses one Twilio subaccount per Organization. Provisioning is an internal operation until Meta Embedded Signup replaces it.

Apply migrations first, then run the provisioning command. It prompts for the subaccount Auth Token using masked terminal input, so the token is not stored in shell history:

```bash
pnpm --filter @workspace/api channel:provision:twilio -- \
  --organization-id 01K1EDN69NFBWCG42B2H99V2C1 \
  --name "WhatsApp Support" \
  --address +5511999999999 \
  --account-sid AC00000000000000000000000000000000
```

When stdin is not an interactive terminal, the command still accepts the Auth Token from stdin for controlled automation. Never pass it as a command-line argument.

The command verifies that the subaccount exposes an `ONLINE` WhatsApp Sender for the address, encrypts the Auth Token, activates the provider-neutral Channel Connection, and writes an immutable Audit Event. Rerunning it updates the existing connection rather than creating a duplicate.

`PUBLIC_API_URL` must be the externally visible API origin used in Twilio's webhook configuration. Twilio signs the exact callback URL, so a proxy-only internal origin cannot be used for signature validation.

Generate a deployment-specific credential encryption key with `openssl rand -base64 32`. Keep the key outside the database and increment `CHANNEL_CREDENTIALS_KEY_VERSION` when deliberately rotating it.

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
