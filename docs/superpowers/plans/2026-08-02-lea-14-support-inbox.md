# LEA-14: Build the minimal WhatsApp Support Inbox

## Goal

Give authenticated Organization members an operator-facing Support Inbox where they can see tenant-scoped WhatsApp Support Conversations, open one, and read its canonical Message timeline without using provider consoles.

The UI may reuse the strongest interaction patterns from `echo-clone`, but the implementation remains Channel-first and API-backed. It must not import Convex, AI-thread, widget, session, visitor, or provider-console assumptions.

## Decisions

1. **System of record**: PostgreSQL Support Conversations and Messages remain canonical. Twilio, WebSocket connections, and TanStack Query caches are not sources of truth.
2. **Tenant boundary**: authenticated API routes derive the Organization exclusively from the active Better Auth Membership. No inbox endpoint accepts a client-controlled Organization ID.
3. **Read model**: add an API-owned Support Inbox projection instead of exposing database rows. The list returns status, Contact display identity, WhatsApp address, last activity, last Message preview, and last sender attribution. The detail returns conversation context and the full Message timeline.
4. **Timeline scope**: LEA-14 renders persisted Messages only. Audit Events remain out of scope until the model provides an explicit, uniform Support Conversation association.
5. **Realtime refresh**: WebSocket is an authenticated, tenant-scoped invalidation channel. After a committed inbound Message, the API publishes a small `support_conversation.updated` signal. The web client invalidates the relevant TanStack Query keys and refetches canonical HTTP DTOs.
6. **WebSocket payload**: events contain only business IDs and an event type. They do not contain Message bodies, phone numbers, provider payloads, or credentials.
7. **Connection lifecycle**: the browser reconnects with bounded exponential backoff, reconnects when the page becomes visible, and always retains manual retry through HTTP error states. WebSocket loss must not remove already-cached inbox data.
8. **Deployment scope**: the first notifier is process-local because inbound persistence and the WebSocket server run in the same API runtime today. The notifier interface remains replaceable by Redis pub/sub when API horizontal scaling or worker-originated events require cross-process fan-out.
9. **Navigation**: use `/inbox` for the list and `/inbox/[conversationId]` for selection. Desktop keeps a persistent master/detail workspace. Mobile shows one pane at a time with an explicit back action.
10. **Status filtering**: expose All plus the four canonical states: `open`, `ai_active`, `human_required`, and `resolved`. Keep filter state in the URL so it is shareable and survives navigation.
11. **Pagination**: use deterministic cursor pagination ordered by `last_activity_at DESC, id DESC`. Do not return an unbounded tenant queue.
12. **Operator actions**: reply, escalate, and resolve controls are not implemented in this slice. Those mutations, WhatsApp care-window enforcement, and outbound delivery belong to LEA-15.

## API Design

### `GET /v1/support-conversations`

Authenticated with `requireUser` followed by `requireMembership`.

Query parameters:

- `status`: optional canonical Support Conversation status
- `cursor`: optional opaque pagination cursor
- `limit`: bounded page size with an API-owned default

Response:

```ts
{
  items: Array<{
    id: string
    status: "open" | "ai_active" | "human_required" | "resolved"
    contact: {
      displayName: string | null
      address: string
      channelType: "whatsapp"
    }
    lastActivityAt: string
    lastMessage: {
      preview: string
      senderType: "contact" | "ai" | "operator" | "system"
      contentType: "text" | "unsupported"
    } | null
  }>
  nextCursor: string | null
}
```

### `GET /v1/support-conversations/:conversationId`

Authenticated and qualified by both Organization and Support Conversation ID to prevent IDOR access.

Response:

```ts
{
  conversation: {
    id: string
    status: "open" | "ai_active" | "human_required" | "resolved"
    contact: {
      displayName: string | null
      address: string
      channelType: "whatsapp"
    }
    channelConnection: {
      id: string
      name: string
      address: string | null
    }
    lastActivityAt: string
    resolvedAt: string | null
  }
  messages: Array<{
    id: string
    direction: "inbound" | "outbound"
    senderType: "contact" | "ai" | "operator" | "system"
    contentType: "text" | "unsupported"
    body: string | null
    status: string
    occurredAt: string
    operatorName: string | null
  }>
}
```

Messages are ordered by `occurred_at ASC, id ASC`.

### `GET /v1/support-conversations/events`

Authenticated WebSocket endpoint. A connection subscribes only to the active Organization resolved by the auth guards.

Event:

```ts
{
  type: "support_conversation.updated"
  conversationId: string
}
```

The inbound ingestion path emits this event only after the persistence transaction commits.

## Web Design

### Desktop

- Keep `PageHeader` above a bounded inbox workspace.
- Use a compact conversation list on the left and the selected timeline on the right.
- Rows show Contact display name with normalized WhatsApp address fallback, status label, last activity, one-line preview, and explicit last-sender attribution.
- Selection uses the established restrained moss accent; status does not rely on color alone.
- The unselected detail pane teaches the operator to select a conversation.

### Mobile

- `/inbox` renders the full-width queue.
- `/inbox/[conversationId]` renders the full-width detail with a visible back action.
- Preserve the existing mobile app-shell header and avoid a compressed side-by-side layout.

### Timeline

- Render canonical attribution for Contact, AI, Operator, and System.
- Group alignment by direction while keeping sender label, timestamp, and delivery state visible.
- Unsupported content renders a truthful placeholder instead of invented text.
- The detail is read-only in LEA-14 and does not render a disabled fake composer.

### UI States

- First load: shape-matched skeletons.
- Refetch after WebSocket signal: keep cached data visible.
- Empty list: explain that inbound WhatsApp conversations will appear here.
- List/detail failure: visible error with retry.
- Missing or cross-tenant detail: calm not-found state without leaking resource existence.

## Implementation Sequence

### 1. Support Inbox API module

- Add `apps/api/src/modules/support-inbox/` with `http/routes.ts`, `repositories/support-inbox-repository.ts`, `schemas.ts`, and `types.ts`.
- Implement tenant-qualified list and detail projections with deterministic ordering and bounded pagination.
- Register routes from `apps/api/src/app.ts` using the existing auth guards.
- Map dates and database values into explicit JSON DTOs.

### 2. Realtime invalidation

- Add `@fastify/websocket` and its TypeScript peer types to `apps/api`.
- Add a Support Inbox event broker that tracks sockets by Organization and removes closed sockets.
- Register the WebSocket plugin before routes and protect the events endpoint with the same auth and Membership guards.
- Publish `support_conversation.updated` after successful inbound ingestion.
- Keep the broker behind a small interface so Redis pub/sub can replace process-local fan-out later.

### 3. Web data hooks

- Add `apps/web/modules/inbox/types.ts` and query-key helpers.
- Add credentials-including HTTP functions inside `modules/inbox/hooks`; do not use `authClient` for non-auth APIs.
- Add list and detail TanStack Query hooks with explicit error handling and cached-data preservation.
- Add one WebSocket hook that invalidates list and matching detail keys on tenant-scoped events.

### 4. Inbox UI

- Add presentational components under `apps/web/modules/inbox/ui/components/` for the list, row, status label, empty/error/loading states, conversation header, and Message timeline.
- Add page-sized views under `apps/web/modules/inbox/ui/views/`.
- Replace the placeholder in `app/(dashboard)/inbox/page.tsx` with the list view.
- Add `app/(dashboard)/inbox/[conversationId]/page.tsx` as a thin authenticated route using promised Next.js 16 params.
- Preserve Hugeicons, existing tokens, keyboard focus, tabular timestamps, and structural mobile behavior.

### 5. Verification

- API route tests: unauthenticated, Membership required, tenant isolation, status filter, deterministic order, pagination, Contact fallback, latest Message projection, detail ordering, and not found.
- WebSocket tests: rejected unauthenticated upgrade, Organization-scoped delivery, no cross-tenant delivery, and socket cleanup.
- Ingestion test: publish only after committed persistence and do not publish for rejected events.
- Web verification: typecheck, lint, production build, and manual responsive checks for loading, empty, error, populated list, selected detail, and realtime invalidation.

## Acceptance Mapping

- **Tenant-scoped list**: Membership-derived Organization predicate on every list query plus status, identity, last activity, preview, and sender projection.
- **Conversation detail**: Organization-qualified detail endpoint and ordered canonical Message timeline.
- **Organization isolation**: Better Auth guards at HTTP and WebSocket boundaries plus composite tenant predicates in repositories.
- **Refresh on inbound Messages**: post-commit tenant event invalidates TanStack Query and refetches canonical API data.

## Out of Scope

- Operator replies and outbound WhatsApp delivery
- Escalate, resolve, or reopen mutations
- WhatsApp 24-hour care-window enforcement and templates
- Audit Event rendering in the unified timeline
- Unread state, assignment, SLA, search, and bulk actions
- Redis-backed WebSocket fan-out across multiple API replicas
- Worker-originated realtime events
