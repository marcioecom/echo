<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes - APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Echo Agent Guide

Read these sources before changing code:

1. `CONTEXT.md`
2. `docs/superpowers/specs/2026-07-19-whatsapp-first-support-platform-design.md`
3. `docs/engineering/ai-code-design-guide.md`

If sources conflict, use this precedence order:

1. `CONTEXT.md` and approved specs
2. `AGENTS.md`
3. `docs/engineering/ai-code-design-guide.md`

## Project Direction

- This repository is a functional reference for product shape, inbox flow, and UI patterns.
- Do not copy its current widget-first or Convex-first architecture into the new Echo implementation.
- The new platform target is a monorepo with `apps/web`, `apps/api`, and `apps/worker`.
- Use `pnpm` for installs, development, linting, and tests.

## Domain Guardrails

- Keep the core model channel-first, not widget-first.
- The persistent support core is `Contact + ChannelIdentity + SupportConversation`.
- `Twilio` is an adapter, not the source of truth.
- `LangGraph` is orchestration, not the system of record.
- The `Support Inbox` is the operator system of record.
- Do not reintroduce `session`, `visitor`, `lead`, or widget-scoped contact modeling.

## Data Model

- Use ULIDs for primary keys in every database table, including Better Auth-owned tables.
- Store ULIDs consistently as 26-character, URL-safe strings.
- Name PostgreSQL tables and columns in plural `snake_case`, including Better Auth-owned tables.

## Code Organization

- Prefer `modules/<feature>` in `apps/web` and `src/modules/<feature>` in `apps/api` and `apps/worker`.
- Keep `apps/web/app`, `apps/web/components`, `apps/web/hooks`, and `apps/web/lib` at the app root; do not migrate the web app into a `src` directory.
- Keep `app/` route files thin.
- In `apps/web`, keep `modules/<feature>/ui` presentational; business logic, data fetching, mutations, and form state live in `modules/<feature>/hooks`.
- Share code through `packages/*` only when at least two apps truly need it.
- Never import source code directly from one app into another app.
- Keep provider-specific code at the edges.

## Web Auth And Data Fetching

- Auth-domain calls (session, sign-in, sign-up, sign-out, organization, invitations) always go through `authClient` from `apps/web/lib/auth-client.ts`; never hand-rolled `fetch` to `/api/auth/*`.
- Server components read session and workspace through the helpers in `apps/web/modules/auth/server/session.ts`, which call `authClient` with forwarded request headers.
- Do not create custom aggregation endpoints for auth state such as `/v1/me`; compose Better Auth built-ins like `getSession` and `organization.getFullOrganization` instead.
- Non-auth backend calls use `@tanstack/react-query` inside `modules/<feature>/hooks`.
- Forms use `react-hook-form` + `zod` with `@workspace/ui/components/form`; the form hook lives in `modules/<feature>/hooks/use-*-form.ts`.

## Environment

- Keep environment files and examples app-local; do not introduce a root environment file shared by all runtimes.

## Imports

- Write TypeScript imports without file extensions; do not use `.js` suffixes in source imports.

## Design Context

- `PRODUCT.md`: register (product), users, brand personality, anti-references, design principles.
- `DESIGN.md`: the visual system. OKLCH tokens in `packages/ui/src/styles/globals.css`, typography, layout, components, motion.
- Color strategy is Restrained: pure white surfaces plus the moss-green primary reserved for the primary action, current selection, and positive state. Never decorative green.
- App shell lives in `apps/web/modules/shell/` (sidebar + `PageHeader`). New dashboard pages use `PageHeader` and stay inside the shell.

## UI Components

- UI components come from `@workspace/ui` (shadcn-style, Hugeicons only). Dark mode tokens are structured but not yet designed; no theme toggle until that pass.
- Add new shadcn UI components through `pnpm dlx shadcn add <component>` so the configured registry and project conventions remain the source of truth. Do not hand-roll registry components.

## Start Checklist

- Which app owns this change: `apps/web`, `apps/api`, `apps/worker`, or a shared package?
- Does the change preserve the approved domain glossary?
- Is the logic in the thinnest correct layer?
- Am I accidentally copying widget-first or provider-first assumptions?
- Do I need to read `docs/engineering/ai-code-design-guide.md` before editing?
