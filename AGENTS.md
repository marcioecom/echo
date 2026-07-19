<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes - APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Echo Agent Entry Guide

Read these sources before changing code:

1. `CONTEXT.md`
2. `docs/superpowers/specs/2026-07-19-whatsapp-first-support-platform-design.md`
3. `CLAUDE.md`
4. `docs/engineering/ai-code-design-guide.md`

If sources conflict, use this precedence order:

1. `CONTEXT.md` and approved specs
2. `CLAUDE.md`
3. `AGENTS.md`
4. `docs/engineering/ai-code-design-guide.md`

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

## Code Organization

- Prefer `src/modules/<feature>` for feature slices across apps.
- Keep `app/` route files thin.
- Share code through `packages/*` only when at least two apps truly need it.
- Never import source code directly from one app into another app.
- Keep provider-specific code at the edges.

## Start Checklist

- Which app owns this change: `apps/web`, `apps/api`, `apps/worker`, or a shared package?
- Does the change preserve the approved domain glossary?
- Is the logic in the thinnest correct layer?
- Am I accidentally copying widget-first or provider-first assumptions?
- Do I need to read `docs/engineering/ai-code-design-guide.md` before editing?
