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
    lifecycle.ts                  # pure private session-state transitions
    session.ts                    # Baileys runtime and lifecycle effect interpreter
    recent-messages.ts            # Redis-backed message lookup for Baileys retries
```

`ownership/registry.ts` owns distributed connection lifecycle. It acquires Redis leases, claims fenced Postgres ownership, admits sessions, starts per-connection workers, reconciles ownership, and shuts sessions down. `lifecycle.ts` defines the private connection phases and pure transitions. `session.ts` interprets those transitions around Baileys callbacks, timers, persistence, and queues. `adapters/` translates the provider contract without changing queue or event payloads.

Redis leases prevent duplicate owners; `owner_token` fences Postgres writes. Only the owner consumes that connection's pairing/send queue. The shared queue carries connect/logout intents.

## Local development

```bash
cp apps/wa-gateway/.env.example apps/wa-gateway/.env
pnpm --filter @workspace/wa-gateway dev
```

| Check        | Command                                         |
| ------------ | ----------------------------------------------- |
| Unit tests    | `pnpm --filter @workspace/wa-gateway test`      |
| Typecheck    | `pnpm --filter @workspace/wa-gateway typecheck` |
| Lint         | `pnpm --filter @workspace/wa-gateway lint`      |
| Build        | `pnpm --filter @workspace/wa-gateway build`     |
| Integration  | `pnpm --filter @workspace/wa-gateway test:integration` |

The integration command reads `apps/wa-gateway/.env`. Point it only at disposable Postgres and Redis services. The session-directory integration test deletes organizations with the `wa-gw-session-dir-` slug prefix.

Logs never include message bodies, QR strings, or pairing codes. The Baileys logger stays at `warn` and redacts those fields.
