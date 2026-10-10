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

Required GitHub configuration (do not commit these):

- Repository secret `CLOUDFLARE_API_TOKEN` — Workers edit permission
- Repository secret `CLOUDFLARE_ACCOUNT_ID`
- Repository variables `VITE_API_URL` and `VITE_APP_URL` for the production API and site origins

The workflow is `.github/workflows/deploy-web.yml`. It builds `apps/web` from the monorepo root (workspace packages must resolve) and deploys with Wrangler.

Manual deploy from a machine already authenticated with Wrangler:

```bash
VITE_API_URL=https://api.example.com VITE_APP_URL=https://echo.example.com pnpm --filter web deploy
```
