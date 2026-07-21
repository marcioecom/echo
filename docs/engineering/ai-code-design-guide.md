# Echo AI Code Design Guide

## Purpose

This guide exists to help AI agents and human contributors build the new Echo implementation with consistent architecture, naming, folder organization, and delivery discipline.

It is not a generic style guide. It translates the approved Echo domain model and the best reusable patterns from the reference repositories into explicit engineering rules.

## Sources Of Truth

Use these sources in this order:

1. `CONTEXT.md`
2. `docs/superpowers/specs/2026-07-19-whatsapp-first-support-platform-design.md`
3. `CLAUDE.md`
4. `AGENTS.md`
5. this guide

Reference repositories are pattern references only. They are not architecture to copy blindly.

## Reference Repo Extraction

### `echo-clone`

Copy:

- monorepo mindset
- inbox-oriented product thinking
- conversation detail decomposition
- dashboard-level layout composition

Do not copy:

- Convex coupling
- cross-app source imports
- widget-first modeling such as `contactSessions` or `widgetSettings`
- provider-specific entities as the core domain model

Why:

`echo-clone` is useful for product shape and operator workflow, but its current technical foundation is tied to a widget-first, Convex-first architecture that is explicitly out of bounds for the new platform.

### `meet-ai-clone`

Copy:

- thin `src/app/**` pages
- module-owned `params.ts`, `schemas.ts`, and `types.ts`
- module-owned `ui/views` and `ui/components`
- prefetch and hydration discipline

Do not copy:

- fullstack Next.js assumptions where frontend and backend are the same runtime
- vendor-specific domain modeling
- product-specific monetization and meeting lifecycle logic

Why:

`meet-ai-clone` is strong on route thinness and feature structure, but Echo has a separate API and worker runtime, so its boundaries must be adapted rather than copied directly.

### `nodebase-clone`

Copy:

- strong feature package regularity
- explicit `server/params-loader.ts` and `server/prefetch.ts` helpers where they make sense
- predictable naming conventions
- clean separation between shared UI, feature code, and app-wide infra

Do not copy:

- workflow-builder-specific structures
- per-node executor patterns unless Echo later adds a comparable builder
- tool-specific subscription logic and integration inventory

Why:

`nodebase-clone` is valuable for structural discipline, but its domain model is workflow automation rather than customer support.

## Target Echo Monorepo Shape

The new Echo platform should be built as a monorepo with these execution surfaces:

```text
apps/
  web/
  api/
  worker/
packages/
  domain/
  db/
  ui/
  config/
  testing/
```

The exact package list can evolve. The important rule is that `apps/web`, `apps/api`, and `apps/worker` are the primary runtimes, and shared packages exist only when at least two apps truly need the code.

### App Ownership

`apps/web` owns:

- the Support Inbox UI
- auth UI flows
- operator-facing admin screens
- page composition and client-side interaction

`apps/api` owns:

- authenticated API endpoints
- public webhooks such as Twilio ingress
- core domain orchestration at request boundaries
- tenancy, auth, and persistence-facing application logic

`apps/worker` owns:

- background jobs
- retries and dead-letter handling
- outbound delivery execution
- LangGraph orchestration and async side effects

`packages/*` may own:

- pure domain types and schemas
- shared UI primitives
- database clients and schema helpers
- shared config helpers
- test utilities

`packages/*` should not become a dumping ground for app-specific business logic.

## Global Architectural Rules

- Use `pnpm` for installs, dev commands, linting, and tests.
- Prefer `modules/<feature>` in `apps/web` and `src/modules/<feature>` in `apps/api` and `apps/worker`.
- Never import source code directly from one app into another app.
- Share stable code through `packages/*` only.
- Keep provider-specific code at the edges.
- Keep transport concerns outside the core domain model.
- If code has a business name, give it a business-named module or file. Do not hide domain logic in a generic `lib/` or `utils.ts` catch-all.

## Feature Folder Conventions

Standardize on `modules` across the monorepo.

Reason:

- it matches the best parts of `echo-clone` and `meet-ai-clone`
- it reads naturally in web, API, and worker code
- it preserves the slice-oriented discipline seen in `nodebase-clone`

If a module does not need every subfolder listed below, omit the unused ones. Keep the structure minimal but consistent.

## Web Structure

Keep `apps/web/app/**` thin.

Route files should mainly do:

- auth and membership checks
- params parsing
- server-side data loading or prefetch
- rendering of a module-owned view

Real feature code should live in `apps/web/modules/<feature>`.

Recommended shape:

```text
apps/web/
  app/
  components/
  hooks/
  lib/
  modules/
    inbox/
      hooks/
      server/
      ui/components/
      ui/views/
      params.ts
      schemas.ts
      types.ts
```

Rules:

- `components` is for cross-feature UI building blocks, not feature-specific screens.
- `lib` is for small app-wide adapters or helpers, not business rules.
- `modules/<feature>/server` may contain param loaders, prefetchers, or API-client composition for that feature.
- `modules/<feature>/hooks` owns the feature's client-side business logic: react-query queries and mutations, form state (`react-hook-form` + `zod`), and calls to `authClient` or the backend API.
- `modules/<feature>/ui/views` should hold page-sized views.
- `modules/<feature>/ui/components` should hold smaller feature-owned UI pieces.
- Code under `modules/<feature>/ui` stays presentational. It consumes hooks and renders; it does not own fetch, query, mutation, or submit logic.

## API Structure

Organize `apps/api` by business module, not by provider.

Recommended shape:

```text
apps/api/src/
  modules/
    support-conversations/
      domain/
      http/
      repositories/
      services/
      schemas.ts
      types.ts
  plugins/
  lib/
```

Rules:

- `http/` owns route registration, request parsing, and response shaping.
- `domain/` owns invariants, policies, and business decisions.
- `repositories/` own persistence access.
- `services/` are allowed when a module needs coordination across repositories, queues, or adapters.
- add `adapters/` only when a module truly owns provider translation logic that should stay at the edge.
- `plugins/` is for app-wide Fastify infrastructure such as auth, db, telemetry, or config wiring.

Twilio should never become the top-level organizing principle of API code.

## Worker Structure

Organize `apps/worker` by business module as well.

Recommended shape:

```text
apps/worker/src/
  modules/
    support-conversations/
      jobs/
      handlers/
      orchestration/
      services/
      schemas.ts
  lib/
```

Rules:

- `jobs/` defines job payload contracts and enqueue-facing helpers when needed.
- `handlers/` run job entrypoints.
- `orchestration/` owns LangGraph flows and other async decision pipelines.
- `services/` coordinate delivery, retries, or state updates without redefining the domain model.
- the worker may decide actions and update operational state, but it must not invent a parallel source of truth for core support entities.

## Shared Package Rules

Safe to share early:

- pure domain types and validation schemas
- db client and schema helpers
- auth helpers that are truly used across multiple apps
- design-system primitives
- test utilities
- config helpers

Unsafe to share early:

- product-specific Support Inbox screens
- Twilio webhook handlers
- worker job runners
- business services that depend on app-local runtime details

Create a shared package only when two apps already need the same stable code. Do not centralize speculative abstractions.

## Naming Conventions

Use English for canonical engineering docs, code comments, and file names.

Follow the approved Echo glossary in code:

- `Channel`
- `ChannelConnection`
- `ChannelIdentity`
- `Contact`
- `SupportConversation`

Avoid core names such as:

- `session`
- `visitor`
- `lead`
- `widgetSettings`
- provider-shaped names as the primary business abstraction

Recommended file naming patterns:

- `*-view.tsx` for page-sized feature views
- `*-dialog.tsx` for modal flows
- `*-form.tsx` for reusable forms
- `*-panel.tsx` for bounded subpanels
- `use-*.ts` for hooks
- `params.ts` for query and route param definitions
- `schemas.ts` for validation schemas
- `types.ts` for feature-local types
- `server/params-loader.ts` when a module needs server-side param normalization
- `server/prefetch.ts` when a module needs dedicated prefetch helpers

Keep naming regular across sibling modules. Agents should not invent a new pattern for each feature.

## Layering And Dependency Rules

- Pages do not hold business logic.
- React components do not define domain invariants.
- Webhook handlers do not run long AI flows inline.
- Provider payloads must be normalized before entering the core model.
- UI code must not talk directly to Twilio or LangGraph.
- Twilio and LangGraph are replaceable adapters at the edges.
- Better Auth, Twilio, Redis, Postgres, and LangGraph integration code belongs in app-owned boundaries, not scattered through unrelated modules.

## Echo Domain Guardrails

These rules are mandatory.

- Keep the core domain channel-first, not widget-first.
- The persistent support core is `Contact + ChannelIdentity + SupportConversation`.
- Do not model the supported person as a `session`, `visitor`, or widget-scoped identity.
- WhatsApp is the first `Channel`, not a special-case architecture.
- `Twilio` is an adapter, not the source of truth.
- `LangGraph` is orchestration, not the system of record.
- The `Support Inbox` is the operator system of record.
- Every tenant-scoped record in the support core must preserve the `Organization` boundary.
- Do not use provider IDs as the primary business identity for core entities.

## Implementation Patterns By App

### `apps/web`

Copy from the reference repos:

- thin route files
- module-owned page views
- predictable feature-owned hooks, params, and types
- inbox-style UI decomposition

Apply them this way in Echo:

- route files should delegate to module views instead of embedding the workflow directly
- loading, empty, error, and happy paths should be explicit for operator-facing screens
- feature-owned server helpers may parse params or prepare API-backed data for the page
- cross-feature UI stays in `src/components`, while inbox-specific pieces stay inside the inbox module

#### Auth And Data Fetching

Echo splits auth across two runtimes: `apps/api` owns the Better Auth server, `apps/web` owns the UI. The reference repos co-locate both in one Next.js runtime, so their patterns are adapted as follows:

- All auth-domain calls (session, sign-in, sign-up, sign-out, organization, invitations) go through `authClient` from `@/lib/auth-client`, which points at `apps/api`. Never hand-roll `fetch` calls to `/api/auth/*`.
- Client components act through `authClient` methods and read auth state through its hooks (for example `authClient.useSession()`).
- Server components read session and workspace through the helpers in `modules/auth/server/session.ts` (`getSession`, `requireUser`, `getWorkspace`, `requireWorkspace`). These helpers call `authClient` with the incoming request headers forwarded, never raw HTTP.
- Better Auth built-ins are the source of truth for auth state. Do not create custom aggregation endpoints such as `/v1/me`; compose `getSession` with `organization.getFullOrganization` instead.
- Backend API calls outside the auth domain use `@tanstack/react-query` (`useQuery`/`useMutation`) inside `modules/<feature>/hooks`. `authClient` calls may also be wrapped in react-query when the UI needs loading, error, or invalidation handling.
- Forms use `react-hook-form` + `zod` with `@workspace/ui/components/form`. The form definition (schema, `useForm`, submit handler) lives in `modules/<feature>/hooks/use-*-form.ts`; the view only renders it.
- `apps/web/proxy.ts` is only an optimistic gate using `getSessionCookie` from `better-auth/cookies`. Authoritative auth and membership checks stay in server components and layouts.

### `apps/api`

Rules:

- keep Fastify modules thin at the HTTP boundary
- move policy and invariant logic into domain or service files
- normalize Twilio payloads before they reach the support core
- persist inbound message state before async orchestration starts
- keep auth and tenancy checks near the application boundary, not repeated ad hoc in every route

### `apps/worker`

Rules:

- never execute the AI flow inside webhook request handling
- keep job handlers idempotent when provider retries are possible
- model retries, failure states, and dead-letter behavior explicitly
- if orchestration fails, degrade toward operational safety, usually `human_required`

### `packages/*`

Rules:

- keep packages focused and boring
- packages should expose stable interfaces, not leak app internals
- do not move code into packages until reuse is real

## Operational Rules For Agents

### Before Writing Code

- read `CONTEXT.md`, `CLAUDE.md`, and the approved spec relevant to the task
- identify which app owns the change
- confirm the change preserves Echo domain guardrails
- prefer the smallest correct change inside the owning module

### Testing Expectations

- every domain-rule change needs unit coverage near the owning module
- every webhook, queue, or persistence boundary change needs integration coverage
- UI changes should verify loading, empty, error, and happy states when those states exist
- run the narrowest relevant test command first, then broaden only if the narrow pass succeeds
- validate at small scale before running wider suites

### Database And Migrations

- schema changes must be tenant-aware by default
- every persistent support-core record must preserve `Organization` boundaries
- migrations should be additive and explicit unless there is an approved reason otherwise
- never introduce provider IDs as the primary key of business entities
- document new invariants that affect existing data

### Environment And Secrets

- centralize env access per app
- keep secrets in config boundaries or secret managers, never embedded in feature logic
- treat Twilio, Better Auth, database, Redis, and LLM credentials as edge configuration, not domain data
- add env variables only when the owning app actually needs them

### Observability And Failure Handling

When a flow introduces these identifiers, log them in structured form where relevant:

- `organizationId`
- `conversationId`
- `channelIdentityId`
- `messageId`
- `jobId`

Also preserve these rules:

- retries and dead-letter behavior must be explicit
- outbound delivery failures must become visible state, not silent errors
- AI failures should fall back to an operator-safe state

### Definition Of Done

- code lives in the correct app and module
- naming follows the approved glossary
- app boundaries are preserved
- relevant tests pass
- new env, migration, or operational concerns are documented
- the change does not reintroduce widget-first or provider-first modeling

## Start Checklist

- Which app owns this change?
- Is the model domain-first or provider-first?
- Did I preserve `Contact + ChannelIdentity + SupportConversation`?
- Am I placing the logic in the thinnest correct layer?
- Should this stay local, or is it truly shared?

## Delivery Checklist

- Did I test the changed behavior?
- Did I preserve auth and tenancy boundaries?
- Did I keep Twilio and LangGraph at the edges?
- Did I avoid app-to-app source imports?
- Did I document new constraints if I introduced them?

## Placement Examples

Good placement:

- `apps/api/src/modules/messages/domain/resolve-active-conversation.ts`
- `apps/api/src/modules/channel-connections/http/twilio-webhook-handler.ts`
- `apps/worker/src/modules/support-conversations/orchestration/run-ai-reply.ts`
- `apps/web/modules/inbox/ui/views/conversation-id-view.tsx`

Bad placement:

- `apps/api/src/lib/twilio-conversation-utils.ts` containing conversation policy
- `apps/web/src/components/support-inbox.tsx` when the code is specific to a single feature slice
- `apps/worker/src/lib/langgraph-state.ts` acting as the source of truth for conversation state
- any direct import from `apps/web` into `apps/api` or `apps/worker`

## Final Reminder

Build Echo by reusing the strongest structural habits from the reference repositories, not by inheriting their product-specific or stack-specific baggage.

The target is a WhatsApp-first, channel-oriented, tenant-aware AI support platform with a separate web app, API, and worker. Every code-organization choice should reinforce that architecture.
