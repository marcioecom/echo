# Echo wa-gateway

Stateful Baileys gateway for multiple WhatsApp Channel Connections across instances. Each connection has its own Redis lease, fenced Postgres credentials, and command queue; the gateway resumes eligible sessions after a restart.

The API and worker enqueue `wa-connect` and `wa-logout` on the shared `wa-gateway` queue. Pairing and send commands use `wa-gateway-<channelConnectionId>` because BullMQ queue names cannot contain `:`. Inbound messages and delivery receipts go to `wa-ingress`; QR, pairing code, and status events are published to the Organization inbox channel.

## Layout

The `sessions` module groups ownership, provider adapters, persistence, policies, and traffic controls. These WhatsApp-specific controls stay app-local until another runtime needs the same behavior.

```text
src/
  main.ts                         # listen, resume, shutdown
  app.ts                          # Fastify
  config/env.ts
  lib/                            # postgres, redis, job client
  plugins/health.ts               # /healthz and /readyz
  modules/sessions/
    adapters/                     # Baileys socket/logger and inbound/status translation
    events/                       # Organization inbox events
    ownership/                    # Redis lease, registry, recovery and per-connection workers
    policies/                     # disconnect and reconnect decisions
    repositories/                 # fenced credentials and session state
    traffic/                      # per-connection rate limits and composition pacing
    use-cases/                    # session composition and job dispatch
    workers/                      # shared connect/logout worker
    auth-state.ts                 # encrypted credential write-behind
    session.ts                    # live socket lifecycle and effects
    recent-messages.ts           # Redis-backed message lookup for Baileys retries
```

`ownership/registry.ts` owns one Baileys socket per `channelConnectionId` in each process. Redis leases prevent duplicate owners; `owner_token` fences Postgres writes. Only the owner consumes that connection's pairing/send queue. The shared queue carries connect/logout intents.

## Local development

```bash
cp apps/wa-gateway/.env.example apps/wa-gateway/.env
pnpm --filter @workspace/wa-gateway dev
```

| Script           | What it does                 |
| ---------------- | ---------------------------- |
| `pnpm dev`       | `tsx watch` on `src/main.ts` |
| `pnpm test`      | Vitest                       |
| `pnpm typecheck` | `tsc --noEmit`               |
| `pnpm lint`      | ESLint                       |
| `pnpm build`     | `tsup` → `dist/main.js`      |

Logs never include message bodies, QR strings, or pairing codes. The Baileys logger stays at `warn` and redacts those fields.
