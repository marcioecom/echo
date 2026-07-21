# Echo Project Constraints

## Data Model

- Use ULIDs for primary keys in every database table, including Better Auth-owned tables.
- Store ULIDs consistently as 26-character, URL-safe strings.
- Name PostgreSQL tables and columns in plural `snake_case`, including Better Auth-owned tables.

## Web Structure

- Keep `apps/web/app`, `apps/web/components`, `apps/web/hooks`, and `apps/web/lib` at the app root; do not migrate the web app into a `src` directory.
- Keep `modules/<feature>/ui` presentational; business logic, data fetching, mutations, and form state live in `modules/<feature>/hooks`.

## Web Auth And Data Fetching

- Auth-domain calls (session, sign-in, sign-up, sign-out, organization, invitations) always go through `authClient` from `apps/web/lib/auth-client.ts`; never hand-rolled `fetch` to `/api/auth/*`.
- Server components read session and workspace through the helpers in `apps/web/modules/auth/server/session.ts`, which call `authClient` with forwarded request headers.
- Do not create custom aggregation endpoints for auth state (such as `/v1/me`); compose Better Auth built-ins (`getSession`, `organization.getFullOrganization`) instead.
- Non-auth backend calls use `@tanstack/react-query` inside `modules/<feature>/hooks`.
- Forms use `react-hook-form` + `zod` with `@workspace/ui/components/form`; the form hook lives in `modules/<feature>/hooks/use-*-form.ts`.

## Environment

- Keep environment files and examples app-local; do not introduce a root environment file shared by all runtimes.

## Imports

- Write TypeScript imports without file extensions; do not use `.js` suffixes in source imports.
