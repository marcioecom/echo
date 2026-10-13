# Echo wa-gateway

Stateful Baileys process for one WhatsApp session per pod. It pairs a number (QR or pairing code), keeps encrypted auth keys in Postgres, and talks to the rest of Echo through BullMQ and inbox events.

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
    adapters/                     # Baileys socket, logger, credential cipher
    events/                       # inbox publishes (QR, pairing code, status)
    repositories/                 # encrypted auth keys, session directory
    use-cases/                    # open a session, handle a gateway job
    workers/gateway-worker.ts     # wa-gateway queue, concurrency 1
    auth-state.ts                 # useEchoAuthState write-behind
    session.ts                    # live socket
    registry.ts                   # which socket this process owns
    disconnect.ts                 # DisconnectReason → action
    reconnect.ts                  # attempt cap and backoff
    inbound-filter.ts
    delivery-status.ts
    pacing.ts
    rate-limit.ts
    recent-messages.ts
```

`registry.ts` holds a single slot. [LEA-82](https://linear.app/leapstark/issue/LEA-82) replaces that slot with Redis leases and a `connectionId → session` map. Job handlers keep calling `connect`, `send`, `requestPairingCode`, and `logout`.

`disconnect.ts` and `reconnect.ts` are the F2 policy: restart immediately, back off on a drop, stop on logout, replacement, ban, and pairing timeout. [LEA-83](https://linear.app/leapstark/issue/LEA-83) replaces `nextReconnect` with per-reason backoff and alerts.

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
