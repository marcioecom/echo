# LEA-13: Ingest inbound WhatsApp messages into support conversations

## Goal

Turn an authenticated, normalized inbound WhatsApp event into the Organization's durable support records: resolve or create the Contact and Channel Identity, open or reuse the correct Support Conversation, persist the Message idempotently, and publish an IDs-only worker job after the transaction commits.

Twilio remains an adapter at the HTTP edge. The ingestion service works with an internal Channel message command and does not know how Twilio accounts, signatures, or form payloads work.

## Prerequisite

LEA-12 must first provide:

- an active provider-neutral WhatsApp Channel Connection
- a globally resolvable Twilio provider binding
- encrypted per-subaccount credentials
- canonical webhook URL and signature validation
- normalized authenticated inbound input

LEA-13 must not add a global Twilio fallback or bypass signature validation when a binding is missing.

## Decisions

1. **Idempotency**: Twilio `MessageSid` is stored as `external_message_id`, not used as a business primary key. The existing tenant-qualified unique index is the final database safeguard.
2. **Queue handoff**: use post-commit deterministic enqueue and Twilio retry in this slice. A transactional outbox and named DLQ remain in LEA-18.
3. **Duplicate recovery**: a duplicate webhook returns the existing Message and attempts the same deterministic enqueue again. This repairs a previous request that committed to Postgres but failed before Redis accepted the job.
4. **Conversation policy**: reuse the one unresolved Conversation for `Organization + ChannelIdentity + ChannelConnection`, regardless of elapsed time. A resolved Conversation is never reopened.
5. **Identity policy**: a normalized WhatsApp sender address identifies one Channel Identity within an Organization, even when that person contacts multiple Channel Connections.
6. **Contact name**: Twilio `ProfileName` may initialize a new Contact's display name but never overwrites an existing operator-maintained name.
7. **Message ordering**: use API receipt time as `occurred_at` because the normal inbound webhook does not provide an authoritative sender timestamp. Update `last_activity_at` with `GREATEST` so out-of-order requests cannot move it backward.
8. **Unsupported media**: persist a typed `unsupported` inbound Message with no invented customer text, audit the unsupported content, and let the worker move the Conversation to `human_required`. Return success so Twilio does not retry an event the MVP cannot interpret.
9. **Webhook response**: return HTTP 200 with empty TwiML only after the Message commit and queue publication succeed. Return a retryable 503 after a queue failure. Authentication and routing failures use the generic rejection defined by LEA-12.
10. **Worker scope**: the first processor reloads state from Postgres. It routes unsupported content to a human but does not run LangGraph or generate a reply; those behaviors belong to later issues.

## Internal inbound contract

After LEA-12 authenticates and normalizes the provider request, pass this provider-neutral shape to the ingestion service:

```ts
{
  organizationId: string
  channelConnectionId: string
  channelType: "whatsapp"
  senderAddress: string
  senderDisplayName?: string
  externalMessageId: string
  content: {
    type: "text"
    body: string
  } | {
    type: "unsupported"
    mediaKind?: "image" | "audio" | "video" | "document" | "unknown"
  }
  receivedAt: Date
}
```

Do not pass the raw Twilio request, Auth Token, media URL, Account SID, or provider snapshots into the support-core service or worker job.

## Data model adjustment for unsupported content

Extend `messages` with `content_type`, initially `text | unsupported`.

- Make `body` nullable.
- Require a nonblank body when `content_type = text`.
- Require `body IS NULL` when `content_type = unsupported`.
- Keep `direction = inbound`, `sender_type = contact`, and `status = received` for both forms.
- Record the normalized unsupported media kind in an Audit Event rather than storing Twilio's temporary media URL.

This models that a communication happened without pretending media was text. Future media support can add durable attachment records without rewriting Message identity.

## Transaction and concurrency design

Use one Postgres transaction for all support-core writes. Do not call Redis or Twilio while the transaction is open.

Acquire transaction-scoped advisory locks in this fixed order:

1. provider event: `organizationId + channelConnectionId + externalMessageId`
2. Channel Identity: `organizationId + channelType + senderAddress`
3. Conversation pair: `organizationId + channelIdentityId + channelConnectionId`

Use stable namespaced strings with `pg_advisory_xact_lock(hashtextextended(...))`. The database unique indexes remain correctness backstops; the locks prevent orphan Contacts and avoid using constraint exceptions as normal concurrency control.

Inside the transaction:

1. Recheck that the Organization and WhatsApp Channel Connection are active and tenant-related.
2. Acquire the provider-event lock and look up the existing Message by its external ID.
3. If it exists, return its IDs with `duplicate: true` and perform no additional writes.
4. Acquire the identity lock and find the Channel Identity by Organization, Channel, and normalized sender address.
5. If absent, create one Contact and its Channel Identity. Initialize the Contact display name only on this path.
6. Acquire the Conversation-pair lock and find the unresolved Support Conversation for the identity and connection.
7. Reuse it if present; otherwise create a new `open` Conversation. Do not touch resolved Conversations.
8. Insert the inbound Message with the Twilio Message SID as `external_message_id`.
9. Set Conversation `last_activity_at = GREATEST(last_activity_at, receivedAt)`.
10. For unsupported content, append a system Audit Event in the same transaction.
11. Commit and return Organization, Contact, Channel Identity, Conversation, and Message IDs plus the duplicate flag.

## Queue contract

Add `process-inbound-message` to `packages/jobs`:

```ts
{
  organizationId: string
  channelIdentityId: string
  supportConversationId: string
  messageId: string
}
```

- Queue name: business-oriented, such as `support-conversations`.
- BullMQ job ID: deterministic and colon-free, such as `process-inbound-message--<messageId>`.
- Payload contains IDs only; the worker reloads current tenant-scoped state.
- Move producer-side attempts, backoff, and retention defaults into the shared job definition or pass them explicitly from the producer. Worker-only defaults do not affect jobs created by the API.
- On enqueue failure, log IDs, return 503, and rely on Twilio retry. A retry finds the existing Message and retries the same deterministic enqueue.

## Implementation sequence

### 1. Message content schema

- Extend `packages/domain/src/support.ts` with `text | unsupported` content types and normalized inbound schemas.
- Update `packages/db/src/schema/support.ts` with `content_type`, nullable `body`, and content/body checks.
- Generate and commit the Drizzle migration.
- Extend schema integration coverage for text and unsupported Messages.

### 2. Shared job definition

- Add `packages/jobs/src/schemas/support-conversations.ts`.
- Register the job in `packages/jobs/src/schemas/index.ts`.
- Update `packages/jobs/src/client.ts` so producer behavior applies the intended attempts, exponential backoff, and retention options.
- Add contract tests for payload validation, deterministic job options, and redaction from the payload.

### 3. Twilio payload normalization

- Complete the LEA-12 webhook adapter with a strict form-payload schema for `MessageSid`, `AccountSid`, `From`, `To`, `Body`, `ProfileName`, `NumMedia`, and media content types.
- Normalize `whatsapp:+E164` addresses at the provider boundary.
- Map a nonblank Body to text content.
- Map a blank Body with media to unsupported content.
- Reject malformed authenticated events that have neither text nor recognizable content without entering the core service.
- Do not fetch media in the webhook request.

### 4. Inbound application service

- Add `apps/api/src/modules/messages/types.ts`.
- Add tenant-scoped persistence operations under `apps/api/src/modules/messages/repositories/`.
- Add `apps/api/src/modules/messages/services/ingest-inbound-message.ts` implementing the transaction and lock order above.
- Inject the database and job client at module composition boundaries so integration tests can use real containers without global-state coupling.
- Keep all Twilio names out of this service.

### 5. Webhook composition

- In the LEA-12 route, call the ingestion service only after signature validation and normalization.
- Commit support records, then enqueue `process-inbound-message`.
- Return empty TwiML after successful enqueue.
- Treat duplicate delivery as success after deterministic enqueue succeeds.
- Log structured IDs: `organizationId`, `channelConnectionId`, `channelIdentityId`, `conversationId`, `messageId`, and `jobId`.
- Never log the raw body, profile name, phone numbers at info level, credentials, or signed request headers.

### 6. Worker handoff

- Add a `support-conversations` queue config and queue instance in `apps/worker/src/queues/`.
- Register `process-inbound-message` in `apps/worker/src/processors/registry.ts`.
- Add the processor under `apps/worker/src/processors/support-conversations/`.
- Parse the shared payload, reload the Message and Conversation with Organization-qualified predicates, and reject mismatched IDs.
- For `unsupported` content, atomically move an unresolved Conversation to `human_required` and append an Audit Event.
- For text content, complete successfully without changing ownership or generating a response. LEA-17 will add AI eligibility and LangGraph orchestration.
- Make repeated processor execution safe.

## Main files

Expected additions or changes:

- `packages/domain/src/support.ts`
- `packages/db/src/schema/support.ts`
- `packages/db/src/schema/support.integration.test.ts`
- `packages/db/migrations/*`
- `packages/jobs/src/schemas/support-conversations.ts`
- `packages/jobs/src/schemas/index.ts`
- `packages/jobs/src/client.ts`
- `packages/jobs/src/client.test.ts`
- `apps/api/src/app.ts`
- `apps/api/src/modules/channel-connections/http/register-twilio-whatsapp-webhook.ts`
- `apps/api/src/modules/channel-connections/adapters/normalize-twilio-inbound-message.ts`
- `apps/api/src/modules/messages/types.ts`
- `apps/api/src/modules/messages/repositories/inbound-message-repository.ts`
- `apps/api/src/modules/messages/services/ingest-inbound-message.ts`
- `apps/worker/src/queues/support-conversations.ts`
- `apps/worker/src/queues/support-conversations.config.ts`
- `apps/worker/src/queues/index.ts`
- `apps/worker/src/processors/support-conversations/process-inbound-message.ts`
- `apps/worker/src/processors/registry.ts`

## Verification

### Unit and contract tests

- Twilio form normalization and address normalization
- text, blank text, and unsupported media mapping
- malformed event rejection
- job payload validation and deterministic job ID
- worker tenant-ID consistency checks
- unsupported-content state transition is idempotent

### Database integration tests

- first inbound event creates Contact, Channel Identity, Conversation, and Message
- second event reuses all three persistent support entities
- same identity through another Channel Connection reuses Contact/Identity and creates another Conversation
- inbound after resolution creates a new Conversation and never reopens the old one
- duplicate external Message ID returns the existing Message
- two concurrent copies of one event create one Message
- two concurrent first messages from one sender create one Contact, one Channel Identity, one active Conversation, and two Messages
- concurrent messages through different connections create one identity and one Conversation per connection
- unsupported content persists with a null body and an immutable Audit Event
- `last_activity_at` never moves backward

### API integration tests

- generate signatures with Twilio's real signing helper and inject form-encoded requests
- valid webhook returns 200, persists records, and publishes one IDs-only job
- duplicate webhook persists one Message and resolves to the deterministic job
- invalid signature or unknown routing writes no Contact, Identity, Conversation, or Message
- Redis failure after commit returns 503; retry after Redis recovery creates no duplicate and publishes the job
- unsupported media returns 200 after persistence and enqueue

### Worker integration tests

- valid job reloads the correct tenant-scoped records
- mismatched Organization, Conversation, or Message IDs fail safely
- unsupported content moves the Conversation to `human_required` once
- repeated execution creates no duplicate state transition or Audit Event
- text content performs no AI or outbound side effect in this slice

## Acceptance mapping

- **Resolve or create Contact and Channel Identity**: normalized tenant-scoped identity lookup under a concurrency lock.
- **Open or reuse Support Conversation**: unresolved-pair lookup plus existing partial unique index; resolved Conversations remain closed.
- **Persist before automation**: one Postgres transaction completes before any Redis call.
- **Publish worker job**: deterministic IDs-only BullMQ job, retried through duplicate webhook delivery when publication fails.

## Out of scope

- Transactional outbox, named DLQ, and generalized retry observability; LEA-18
- AI eligibility, retrieval, LangGraph, and auto-response; LEA-17
- Operator inbox projections and UI; LEA-14
- Outbound operator replies; LEA-15
- Media download, storage, transcription, OCR, or rendering
- WhatsApp templates and outbound messages outside the customer care window
- Delivery and read callbacks
