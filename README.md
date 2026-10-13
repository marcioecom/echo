# Echo

Echo is a tenant-aware, WhatsApp-first support platform. The monorepo contains:

- `apps/web`: TanStack Start operator interface (Cloudflare Workers)
- `apps/api`: Fastify API and future Better Auth host
- `apps/worker`: background processing runtime
- `packages/domain`: shared domain contracts and ULID generation
- `packages/db`: Drizzle schema, migrations, and Postgres client
- `packages/config`: shared server environment validation

## Implemented today

This section tracks what is actually built and tested, not the product vision. See [`docs/architecture.md`](docs/architecture.md) for the system diagram.

- **Authentication & organizations.** Better Auth-backed sign-up, sign-in, invitations, and member management, covered by `apps/api/src/modules/auth/auth.integration.test.ts`.
- **WhatsApp channel provisioning.** A CLI command (`channel:provision:twilio`) creates and encrypts per-organization Twilio subaccount credentials, verifies the WhatsApp Sender is `ONLINE`, and writes an immutable audit event. Covered by `channel-connections.integration.test.ts`.
- **Inbound WhatsApp ingestion.** Twilio webhook signature verification, message normalization, and conversation threading, covered by `twilio-webhook.test.ts` and `inbound-message.integration.test.ts`. Inbound processing and outbound delivery are dispatched as BullMQ jobs (`process-inbound-message`, `send-outbound-message`) consumed by `apps/worker`.
- **Support inbox.** Paginated conversation listing with cursor-based pagination, conversation detail, and operator replies, covered by `support-inbox.integration.test.ts` and `create-operator-reply.test.ts`. The web UI exposes this at `/inbox` and `/inbox/$conversationId`.
- **Knowledge base ingestion.** Document upload with a scoped upload token and indexing dispatched via the `index-knowledge-document` job. This module has no automated test coverage yet — treat it as the least mature part of the system.
- **Operational health.** Both the API and worker expose `/health/live` and `/health/ready` probes that fail closed when Postgres or Redis is unavailable, and only report sanitized dependency state.
- **CI.** `.github/workflows/ci.yml` runs lint, typecheck, test, and build on every pull request and push to `main`.

Not yet built: AI-assisted first-line responses described in the public landing page copy, Meta Embedded Signup (channel provisioning is still an internal CLI operation), and a production deployment of this exact codebase — Echo has not been verified running against real customer traffic.

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

## Trace agent runs in LangSmith

The worker sends a LangSmith trace for each inbound support-agent run when `LANGSMITH_API_KEY` is set in `apps/worker/.env`. Without that key, tracing stays off and the worker starts normally. You do not set `LANGSMITH_TRACING` yourself: the worker enables it when the key is present.

```bash
LANGSMITH_API_KEY=lsv2_...
LANGSMITH_PROJECT=echo
```

`LANGSMITH_PROJECT` defaults to `echo`. Each trace is named `support-agent` and includes:

- metadata: `organizationId`, `conversationId`, `messageId`, `channelProvider`, `model`
- tags: `support-agent`, `inbound-message`, and the channel provider (`twilio`, `baileys`, `meta_cloud`, or `unknown`)

The trace shows the graph, a `retrieve_knowledge` retrieval span, and the model call. It includes the customer message and retrieved snippets, which are needed to inspect the run. It does not include channel credentials. Traces are sent in the background and flushed when the worker shuts down.

### Verify a trace locally

1. Create an API key at [smith.langchain.com](https://smith.langchain.com) and a project named `echo`, or set `LANGSMITH_PROJECT` to a project you already have.
2. Put the key in `apps/worker/.env`. Do not commit it.
3. Start infrastructure and the worker:

```bash
pnpm infra:up
pnpm db:migrate
pnpm --filter @workspace/worker dev
```

4. Send a text inbound message through a provisioned WhatsApp connection. The API webhook `POST /webhooks/twilio/whatsapp/inbound` enqueues `process-inbound-message`, which runs the agent.
5. Open the LangSmith project and filter by metadata `organizationId` or `conversationId`. The run should show the `retrieve` step, the `retrieve_knowledge` span, and the model call.

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
