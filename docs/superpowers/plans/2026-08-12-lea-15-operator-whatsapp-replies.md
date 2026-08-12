# LEA-15: Send operator replies from the Support Inbox over WhatsApp

## Goal

Let operators reply to customers directly from the Support Inbox and deliver those replies over the tenant's WhatsApp connection through Twilio. The slice covers drafting a reply, persisting it as an outbound Message, dispatching it asynchronously through the worker, and surfacing delivery state back in the conversation timeline.

Blocked-by dependencies LEA-12 (Twilio channel connection) and LEA-14 (Support Inbox) are complete.

## Decisions

1. **Persist before dispatch**: the reply endpoint writes the outbound Message (`direction: "outbound"`, `senderType: "operator"`, `status: "pending"`, `operator_user_id` from the authenticated session) in the same request, then enqueues delivery. The Message row is canonical; Twilio is not.
2. **Care window**: no client- or server-side pre-check of the 24-hour WhatsApp customer care window in this slice. Free-form sends attempted outside the window are rejected by Twilio (error 63016) and become an explicit, visible `failed` Message state, per the spec's requirement that outbound delivery failures become visible state.
3. **Delivery status**: a new signature-validated Twilio status-callback webhook (`POST /webhooks/twilio/whatsapp/status`) drives `sent -> delivered -> read -> failed` transitions. The worker marks `sent` on Twilio API success as a floor in case callbacks are delayed.
4. **Monotonic status transitions**: delivery/read callbacks are accepted only when the transition is consistent with a status rank (`pending < sent < delivered < read`); `failed` is accepted from any non-terminal outbound state. Out-of-order or regressive callbacks are ignored (and audited), never applied.
5. **Realtime**: Redis pub/sub replaces the process-local broker as the event origin. Both the API (reply creation, status webhook, inbound ingest) and the worker (send result) publish `support_conversation.updated` to `inbox-events:<organizationId>`; the API subscribes and forwards into the existing WebSocket broker. One event path, unchanged client.
6. **Shared provider code**: the credentials cipher and `TwilioChannelProvider` move to a new `packages/messaging` package because the API and worker both need them. The worker gains `CHANNEL_CREDENTIALS_ENCRYPTION_KEY`, `CHANNEL_CREDENTIALS_KEY_VERSION`, and `API_PUBLIC_URL` env vars.
7. **Retry policy**: permanent Twilio errors (63016 outside care window, invalid/unsubscribed numbers) mark the Message `failed` without retry. Transient errors throw and use the existing BullMQ backoff (4 attempts, exponential from 5 min); the final failure marks the Message `failed` and writes an audit event.
8. **Idempotency**: deterministic BullMQ `jobId = send-outbound-message--<messageId>` prevents duplicate enqueue; the worker skips Messages already at `sent` or beyond; `external_message_id` uniqueness dedupes Twilio SIDs.
9. **Resolved conversations**: replies to `resolved` Support Conversations are rejected with 409. Resolution/reopen flows are a later slice.
10. **UI**: composer is a footer of the conversation detail pane (Enter sends, Shift+Enter newline). Timeline status becomes icon + label pairs (never color-only): pending clock, sent single check, delivered double check, read double check in primary, failed destructive with alert icon. Inbound `received` gets no adornment.

## Implementation

### 1. `packages/jobs`

- `schemas/support-conversations.ts`: `send-outbound-message` zod payload `{ organizationId, channelConnectionId, supportConversationId, messageId }`; register in `jobDefinitions` with deterministic jobId.
- Redis inbox event helper: `publishInboxEvent(redis, organizationId, { type: "support_conversation.updated", conversationId })` on channel `inbox-events:<organizationId>`. Same event shape as the existing in-process broker.

### 2. `packages/messaging` (new)

- Move `apps/api/src/modules/channel-messaging/adapters/channel-credentials-cipher.ts` unchanged.
- Move `TwilioChannelProvider` and add `sendWhatsAppTextMessage({ from, to, body, statusCallbackUrl })` wrapping `twilio.messages.create`, returning the SID.
- Update API imports; provisioning CLI and tests keep passing.

### 3. API: reply endpoint

`POST /v1/support-conversations/:conversationId/messages` in `modules/support-inbox`:

- Guards `requireUser` + `requireMembership`; zod body `{ body: string }` trimmed, 1-1600 chars.
- Use case `create-operator-reply`: org-scoped conversation lookup (404 missing, 409 resolved); insert Message (`outbound` / `operator` / `pending` / `operatorUserId = auth.user.id`); bump `last_activity_at`; enqueue `send-outbound-message`; publish inbox event; 201 with message payload.

### 4. Worker: send processor

- Env: `CHANNEL_CREDENTIALS_ENCRYPTION_KEY`, `CHANNEL_CREDENTIALS_KEY_VERSION`, `API_PUBLIC_URL` in `src/config/env.ts`, `.env.example`, compose/k8s.
- `processors/support-conversations/send-outbound-message.ts`: load message + conversation + channel identity + binding org-scoped; idempotent skip if status >= `sent`; decrypt token; send with `statusCallback = ${API_PUBLIC_URL}/webhooks/twilio/whatsapp/status`; success sets `external_message_id` + `sent` and publishes; permanent errors mark `failed` + audit without retry; transient errors throw for backoff, final attempt marks `failed` + audit and publishes.

### 5. API: status webhook

`POST /webhooks/twilio/whatsapp/status` in `modules/channel-messaging`:

- Resolve binding by `AccountSid` + `From`; signature-validate via existing `verifyTwilioWebhook`; reject/audit unknown like inbound.
- Map `MessageStatus`: `queued->pending`, `sent->sent`, `delivered->delivered`, `read->read`, `failed|undelivered->failed`. Update by `(organizationId, channelConnectionId, externalMessageId = MessageSid)` with monotonic rank. Audit on `failed`. Publish inbox event.

### 6. Redis pub/sub bridge

- API plugin: ioredis subscriber on `inbox-events:*` forwarding into `supportInboxEventBroker`.
- API-owned publishes (inbound ingest, reply creation, status webhook) move onto the Redis helper so there is exactly one event path.

### 7. Web

- `pnpm dlx shadcn add textarea` in `packages/ui`.
- Extend `modules/inbox/hooks/api.ts` with POST support.
- `hooks/use-reply-form.ts`: mirrors `use-invite-member-form.ts` (zod + RHF + `useMutation`; success resets and invalidates detail + lists; error toasts).
- `ui/components/reply-composer.tsx`: presentational footer in `ConversationDetail`; Enter sends, Shift+Enter newline; primary send button (Hugeicons), disabled when empty or pending.
- `conversation-detail.tsx` timeline: icon + label status pairs replacing plain text.

## Tests

- API: route unit tests (validation, 404/409, auth); reply endpoint integration test (testcontainers + mocked jobs-client) asserting persisted message + enqueue; status webhook integration tests reusing inbound signature-mock patterns; ordered-transition unit tests.
- Worker: processor integration tests with container DB + mocked provider send: success, permanent error (no retry, failed + audit), transient retry to eventual failed, idempotent re-run.
- Web: manual verification (send, watch pending -> sent -> delivered, failure state).

## Execution order

1. `packages/jobs` job + `packages/messaging` extraction (API tests stay green)
2. API reply endpoint
3. Worker processor + env wiring
4. Status webhook + monotonic transitions
5. Redis pub/sub bridge
6. Web composer + status rendering
7. Lint, typecheck, tests; end-to-end manual run

## Out of scope

- Care-window pre-checks and template-based outbound outside the window
- AI-originated outbound messages (LEA-17)
- Retry/DLQ hardening and observability beyond the above (LEA-18)
- Conversation resolve/reopen controls
