import path from "node:path"
import { fileURLToPath } from "node:url"

import { cloudflare } from "@cloudflare/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const appRoot = fileURLToPath(new URL(".", import.meta.url))

export default defineConfig({
  server: {
    port: 3000,
  },
  resolve: {
    tsconfigPaths: true,
    alias: {
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
  ],
  ssr: {
    noExternal: ["@workspace/ui", "@workspace/auth", "@workspace/domain"],
  },
})
