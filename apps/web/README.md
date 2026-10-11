# Echo web

TanStack Start operator interface, deployed on Cloudflare Workers.

## Local development

```bash
cp apps/web/.env.example apps/web/.env
pnpm --filter web dev
```

`vite dev` uses the Cloudflare Vite plugin, so the Worker runtime matches production. The Better Auth cookie stays first-party: the browser calls `/api/auth/*` on the web origin, and a Start server route proxies those requests to `VITE_API_URL`.

| Variable       | Where it is read                         | Example                   |
| -------------- | ---------------------------------------- | ------------------------- |
| `VITE_API_URL` | Auth proxy, React Query, WebSocket       | `http://localhost:3001`   |
| `VITE_APP_URL` | Public site origin (SEO / absolute URLs) | `http://localhost:3000`   |

Both are public and inlined at build time. Do not put secrets in `VITE_*` variables.

## Scripts

| Script          | What it does                                      |
| --------------- | ------------------------------------------------- |
| `pnpm dev`      | Vite + workerd on http://localhost:3000           |
| `pnpm build`    | Production Worker + static assets                 |
| `pnpm preview`  | Preview the production build locally              |
| `pnpm deploy`   | Build, then `wrangler deploy`                     |
| `pnpm cf-typegen` | Generate Cloudflare binding types               |

## Cloudflare deploy

Production deploys go through **Cloudflare Workers Builds** (project `echo`), not GitHub Actions.

Configure the project so Wrangler runs from the web app, not the monorepo root:

- Root directory: `apps/web`
- or deploy command: `pnpm --filter web exec wrangler deploy`

Set these build-time variables in Workers Builds:

| Variable       | Purpose                                      |
| -------------- | -------------------------------------------- |
| `VITE_API_URL` | Production API origin (inlined at build)     |
| `VITE_APP_URL` | Public web origin (SEO / absolute URLs)      |

Both are public. Do not put secrets in `VITE_*` variables.

`npx wrangler deploy` at the repo root fails (`application detection logic has been run in the root of a workspace`). Use one of the two options above so Wrangler sees `apps/web/wrangler.jsonc`.

Manual deploy from a machine already authenticated with Wrangler:

```bash
VITE_API_URL=https://api.example.com VITE_APP_URL=https://echo.example.com pnpm --filter web deploy
```
