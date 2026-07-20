# LEA-11: Implement Better Auth organizations and internal user access

## Goal

Give every B2B customer Organization isolated internal access: Users sign in with email and password through Better Auth, create or join an Organization, invite other members, and reach a tenant-scoped Support Inbox shell, with membership and role checks gating organization-scoped data in the API.

## Decisions

Resolved in the planning interview:

1. **Credentials**: email + password only. Social login and magic links are deferred; no schema impact to add later.
2. **Sign-up policy**: open sign-up. Joining an existing Organization happens only by accepting an Invitation.
3. **Roles**: custom `owner`, `admin`, `operator` via Better Auth access control (~20 lines), reusing the built-in `ownerAc`/`adminAc` statements. `member` is never stored. Matrix:

   | Action | owner | admin | operator |
   |---|---|---|---|
   | Update organization | yes | yes | no |
   | Create/cancel invitations, manage members | yes | yes | no |
   | Archive organization, manage owners | yes | no | no |
   | Access tenant-scoped data (inbox etc.) | yes | yes | yes |

4. **Onboarding**: dedicated `/onboarding` route after sign-up. Create Organization (name only, slug auto-derived and validated with `checkSlug`) or accept a pending Invitation. Active Organization is resolved server-side at session creation via `databaseHooks.session.create.before`.
5. **Invitation delivery**: real email via Resend, but sent **through the worker queue**, never inline (ADR 0002). The API enqueues `send-invitation-email`; the worker renders and sends with BullMQ retry/backoff. Email verification stays OFF (invitation IDs are opaque ULIDs, which keeps the emailed-link flow safe per Better Auth docs). Members UI also shows copyable invite links as a dev fallback.
6. **API gating**: one Fastify plugin mounts the Better Auth handler and exposes `requireUser` / `requireMembership({ roles })` preHandlers plus `request.auth` decoration. Proof endpoint: `GET /v1/me`. CORS with credentials + `trustedOrigins`.
7. **Web shell**: Next 16 pattern - `proxy.ts` for optimistic cookie-presence redirects, real checks in a DAL (`modules/auth/server/`) calling `/v1/me` with `cache()`. No org switcher in this slice.
8. **Env and tests**: every env var owned by the app that uses it; contract tests for the auth surfaces, no web test infra yet.

## Implementation sequence

### 1. Shared auth permissions and job contract

- Add `packages/auth` with `permissions.ts`: `createAccessControl` over `defaultStatements`, exporting `ac`, `owner`, `admin` (reusing `ownerAc`/`adminAc` statements), and `operator` (no organization-management statements). Consumed by the API auth instance and the web auth client.
- Add the email job contract to `packages/domain`: Zod schema for the `send-invitation-email` payload (`invitationId`, `email`, `inviterName`, `organizationName`, `inviteUrl`) plus queue/job name constants. API produces, worker consumes.

### 2. Runtime auth instance in `apps/api`

- Replace `modules/auth/auth-schema-config.ts` with a `createAuth(env)` factory: `emailAndPassword: { enabled: true }`, `organization` plugin with custom `ac`/`roles`, `advanced.database.generateId: createId`, `trustedOrigins: [env.WEB_APP_URL]`, `databaseHooks.session.create.before` resolving `activeOrganizationId` from the user's first Membership, and `sendInvitationEmail` enqueuing the email job (try/catch: enqueue failure never fails invitation creation).
- Point the `auth:schema:generate` script at the same factory. One instance definition, two consumers (Fastify plugin and CLI).
- No migration expected: LEA-10 tables already cover users/sessions/accounts/organizations/members/invitations; roles are plain text values.

### 3. Email pipeline

- Add `packages/email`: React Email `invite-email` template, `render` helper, Resend client factory, and a `dev` preview script (midday pattern).
- `apps/api`: add `bullmq`, producer helper for the `email` queue in `src/modules/notifications/`.
- `apps/worker`: `src/modules/notifications/` with the job handler (render template from `packages/email`, send via Resend), registered in the `WorkerRegistry` with 3 attempts + exponential backoff. Failed jobs stay retained in BullMQ; a named DLQ arrives with the hardening slice.

### 4. API gating and `/v1/me`

- `src/plugins/auth.ts`: mount `auth.handler` at `/api/auth/*` via the Fetch adapter; `@fastify/cors` with `origin: env.WEB_APP_URL, credentials: true`; decorate `request.auth`; expose `requireUser` (401) and `requireMembership({ roles? })` (403) preHandlers. Public routes (health, future webhooks) stay untouched.
- `src/modules/auth/http/`: `GET /v1/me` behind both preHandlers, returning `{ user, organization, role }` for the active Organization.
- Integration tests (testcontainers, existing infra): sign-up -> sign-in -> create Organization -> invite -> accept -> `/v1/me` carries role; 401 unauthenticated, 403 non-member, 403 Operator calling `invite-member`.

### 5. Web shell

- `apps/web`: `.env.example` with `NEXT_PUBLIC_API_URL`; `lib/auth-client.ts` with `organizationClient({ ac, roles })` and `credentials: "include"`.
- `modules/auth/`: `server/` DAL (`getSession`, `requireWorkspace`, React `cache()`, forwards cookies to `GET /v1/me`); `ui/views/` for login, sign-up, and onboarding.
- `proxy.ts` at app root: optimistic `better-auth.session_token` presence check, redirecting to `/login`.
- Routes: `app/(auth)/login`, `app/(auth)/sign-up`, `app/onboarding` (create Organization or accept Invitation), `app/accept-invitation/[id]` (accept when signed in; redirect through login otherwise).
- `modules/organization/` + `app/(app)/`: shell layout showing active Organization name, current User, Role, and sign-out; `app/(app)/settings/members` with member list, invite form (role select), and pending Invitations with copyable accept link and cancel.
- Manual end-to-end verification of all four acceptance criteria.

### 6. Documentation

- ADR 0002 covering queued email delivery and the shared email package.
- Update app-local `.env.example` files (see below).

## Env changes

| Variable | App | Purpose |
|---|---|---|
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | `apps/api` | auth instance |
| `WEB_APP_URL` | `apps/api` | trusted origin, CORS, invite link base |
| `RESEND_API_KEY`, `EMAIL_FROM` | `apps/worker` | the worker sends email; the API never sees the key |
| `NEXT_PUBLIC_API_URL` | `apps/web` | auth client and DAL base URL |

All variables enter each app's Zod env schema; no loose `process.env` reads.

## Acceptance mapping

- **Sign in through Better Auth and reach the authenticated app shell**: steps 2, 4, 5 (login view, proxy, DAL, `(app)` group).
- **Owner can create or join an Organization and invite another member**: steps 2, 3, 5 (onboarding, invite form, queued email, accept route).
- **Membership and role checks gate organization-scoped data in the API**: step 4 (`requireMembership`, `/v1/me`, plugin access control, integration tests).
- **Shell resolves the active Organization and loads a tenant-scoped workspace**: steps 2 and 5 (session-creation hook, `/v1/me`, shell layout).

## Out of scope

- Email verification and password reset flows
- Org switcher UI
- Social login, magic links
- Named DLQ and notification observability (hardening slice)
- Web test infrastructure (arrives with LEA-14)
- Support Inbox (LEA-14), Channel Connection setup (LEA-12)
