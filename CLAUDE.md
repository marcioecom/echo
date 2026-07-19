# Echo Project Constraints

## Data Model

- Use ULIDs for primary keys in every database table, including Better Auth-owned tables.
- Store ULIDs consistently as 26-character, URL-safe strings.
- Name PostgreSQL tables and columns in plural `snake_case`, including Better Auth-owned tables.

## Web Structure

- Keep `apps/web/app`, `apps/web/components`, `apps/web/hooks`, and `apps/web/lib` at the app root; do not migrate the web app into a `src` directory.

## Environment

- Keep environment files and examples app-local; do not introduce a root environment file shared by all runtimes.

## Imports

- Write TypeScript imports without file extensions; do not use `.js` suffixes in source imports.
