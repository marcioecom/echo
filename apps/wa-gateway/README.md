# Echo wa-gateway

Stateful Baileys process. One pod owns many WhatsApp numbers. Redis leases make sure each number has a single owner across replicas. It pairs a number (QR or pairing code), keeps encrypted auth keys in Postgres, and talks to the rest of Echo through BullMQ and inbox events.

The API and the worker never open a socket. They enqueue `wa-connect`, `wa-pairing-code`, `wa-logout`, and `wa-send`. This process publishes inbound messages and delivery receipts on `wa-ingress`, and publishes `channel.qr`, `channel.pairing_code`, and `channel.status_changed` on the org inbox channel.

## Layout

Same shape as `apps/api`: a thin entrypoint, app-wide `lib` and `plugins`, and one module split into adapters, repositories, use-cases, and a worker.

```text
src/
  main.ts                         # listen, resume, shutdown
  app.ts                          # Fastify
  config/env.ts
  lib/                            # postgres, redis, job client
  plugins/health.ts               # /healthz and /readyz
  modules/sessions/
    adapters/                     # socket, lease, command bus, cipher
    events/                       # inbox publishes (QR, pairing code, status)
    repositories/                 # encrypted auth keys, session directory
    use-cases/                    # open a session, handle a gateway job
    workers/gateway-worker.ts     # wa-gateway queue
    auth-state.ts                 # useEchoAuthState write-behind
    session.ts                    # live socket
    session-manager.ts            # leases, fencing, command routing
    alerts.ts                     # logged_out / banned_suspected log hook
    disconnect.ts                 # DisconnectReason → action
    reconnect.ts                  # per-reason backoff and attempt cap
    inbound-filter.ts
    delivery-status.ts
    pacing.ts
    rate-limit.ts
    recent-messages.ts
```

`session-manager.ts` keeps a `connectionId → session` map. Every few seconds it renews `wa:lease:{connectionId}` (`{token}|{podId}`, TTL 30s). Losing the renew closes that socket without logout. A free number is claimed until `MAX_SESSIONS_PER_POD`. Sends, pairing, and logout that land on the wrong pod are published to `wa:cmd:{connectionId}`; the owner answers on a reply channel. If nobody is listening, the BullMQ job stays retryable.

`disconnect.ts` reads Baileys `DisconnectReason` (7.0.0-rc14). `restartRequired` reconnects immediately. `connectionLost`, `timedOut`, `connectionClosed`, and `unavailableService` use exponential backoff with jitter, capped at 5 minutes and 10 attempts. `loggedOut` clears the auth keys and stops. `forbidden` and `badSession` move the session to `banned_suspected` and stop. Both of those, plus `connectionReplaced` and an exhausted backoff, emit a `channel session alert` log and publish `channel.status_changed`.

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

Two local processes share Postgres and Redis. Give each a name and a port:

```bash
POD_NAME=pod-a WA_GATEWAY_PORT=3003 pnpm --filter @workspace/wa-gateway dev
POD_NAME=pod-b WA_GATEWAY_PORT=3004 pnpm --filter @workspace/wa-gateway dev
```

`channel_session_states.owner_pod` shows who owns each number. Stop one process (SIGTERM releases the lease) and the other claims those numbers on its next loop. A hard kill waits out `LEASE_TTL_MS` (30s) before the survivor can take them.

Logs never include message bodies, QR strings, or pairing codes. The Baileys logger stays at `warn` and redacts those fields.
