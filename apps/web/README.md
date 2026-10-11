# Echo web

TanStack Start operator interface, deployed on Cloudflare Workers.

## Local development

```bash
cp apps/web/.env.example apps/web/.env
pnpm --filter web dev
```

`vite dev` uses the Cloudflare Vite plugin, so the Worker runtime matches production. The Better Auth cookie stays first-party: the browser calls `/api/auth/*` on the web origin, and a Start server route proxies those requests to the runtime `API_URL` Worker var.

| Variable       | Where it is read                                      | Example                         |
| -------------- | ----------------------------------------------------- | ------------------------------- |
| `API_URL`      | Auth proxy at runtime (`wrangler.jsonc` `vars`)       | `https://echo-api.marcio.run`   |
| `VITE_API_URL` | Browser React Query + WebSocket (inlined at build)    | `http://localhost:3001`         |
| `VITE_APP_URL` | Public site origin (SEO / absolute URLs, build-time)  | `http://localhost:3000`         |

`API_URL` is public and lives in `wrangler.jsonc` `vars`. Override it locally with `apps/web/.dev.vars` (`API_URL=http://localhost:3001`) so the proxy talks to `apps/api`. Do not put secrets in `VITE_*` or `API_URL`.

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
| Build variables | `VITE_API_URL`, `VITE_APP_URL` (browser only) |
| Worker vars | `API_URL` ships in `wrangler.jsonc` as `https://echo-api.marcio.run`. No dashboard copy is required unless you override it. |

Do not leave root as `/` with `npx wrangler deploy` — Wrangler then runs at the monorepo root and fails (`application detection logic has been run in the root of a workspace`).

`pnpm build` / `pnpm run deploy` are meant to be run from `apps/web`. Both are public `VITE_*` values, inlined at build time. Do not put secrets in them.
