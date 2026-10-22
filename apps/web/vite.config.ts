import path from "node:path"
import { fileURLToPath } from "node:url"

import { cloudflare } from "@cloudflare/vite-plugin"
import { sentryTanstackStart } from "@sentry/tanstackstart-react/vite"
import tailwindcss from "@tailwindcss/vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const appRoot = fileURLToPath(new URL(".", import.meta.url))
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN

export default defineConfig({
  server: {
    port: 3000,
  },
  resolve: {
    tsconfigPaths: true,
    alias: {
      "@workspace/analytics": path.resolve(
        appRoot,
        "../../packages/analytics/src/index.ts"
      ),
      "@workspace/auth": path.resolve(
        appRoot,
        "../../packages/auth/src/index.ts"
      ),
      "@workspace/domain": path.resolve(
        appRoot,
        "../../packages/domain/src/index.ts"
      ),
    },
  },
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    tanstackStart({
      srcDirectory: "app",
    }),
    viteReact(),
    ...(sentryAuthToken
      ? sentryTanstackStart({
          org: "leapstark",
          project: "echo-web",
          authToken: sentryAuthToken,
        })
      : []),
  ],
  ssr: {
    noExternal: [
      "@workspace/analytics",
      "@workspace/ui",
      "@workspace/auth",
      "@workspace/domain",
    ],
  },
})
