# Echo web

TanStack Start operator interface, deployed on Cloudflare Workers.

## Local development

```bash
cp apps/web/.env.example apps/web/.env
pnpm --filter web dev
```

`vite dev` uses the Cloudflare Vite plugin, so the Worker runtime matches production. The Better Auth cookie stays first-party: the browser calls `/api/auth/*` on the web origin, and a Start server route proxies those requests to `VITE_API_URL`.

| Variable          | Where it is read                         | Example                   |
| ----------------- | ---------------------------------------- | ------------------------- |
| `VITE_API_URL`    | Auth proxy, React Query, WebSocket       | `http://localhost:3001`   |
| `VITE_APP_URL`    | Public site origin (SEO / absolute URLs) | `http://localhost:3000`   |
| `VITE_SENTRY_DSN` | Client + Worker Sentry init              | see `.env.example`        |

`VITE_*` values are public and inlined at build time. Do not put secrets in them.

## Scripts

| Script          | What it does                                      |
| --------------- | ------------------------------------------------- |
| `pnpm dev`      | Vite + workerd on http://localhost:3000           |
| `pnpm build`    | Production Worker + static assets                 |
| `pnpm preview`  | Preview the production build locally              |
| `pnpm deploy`   | `wrangler deploy` (expects a prior `pnpm build`)  |
| `pnpm cf-typegen` | Generate Cloudflare binding types               |

## Deploy (Cloudflare Workers Builds)

Production deploys go through **Workers Builds** (project `echo`), not GitHub Actions. `wrangler` is a `apps/web` devDependency so `npx wrangler` uses the local binary.

Dashboard values:

| Setting | Value |
| --- | --- |
| Root directory | `apps/web` |
| Build command | `pnpm build` |
| Deploy command | `pnpm run deploy` or `npx wrangler deploy` |
| Build variables | `VITE_API_URL`, `VITE_APP_URL`, `VITE_SENTRY_DSN` |
| Secrets | `SENTRY_AUTH_TOKEN` (optional, source maps only) |

Do not leave root as `/` with `npx wrangler deploy` — Wrangler then runs at the monorepo root and fails (`application detection logic has been run in the root of a workspace`).

`pnpm build` / `pnpm run deploy` are meant to be run from `apps/web`. `VITE_*` values are public and inlined at build time. Do not put secrets in them.

Sentry (org `leapstark`, project `echo-web`) uses the public DSN from `VITE_SENTRY_DSN`. Without it, init is skipped. Add this build variable in Workers Builds:

```
VITE_SENTRY_DSN=https://a48c60a1446c5ffe3c044b222d8b7af10@o4511162787561472.ingest.us.sentry.io/4512235409440768
```

To upload source maps, also set `SENTRY_AUTH_TOKEN` as a build secret. The Vite plugin is only enabled when that token is present, so `pnpm build` succeeds without it.
