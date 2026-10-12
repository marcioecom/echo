import path from "node:path"
import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

const appRoot = fileURLToPath(new URL(".", import.meta.url))

export default defineConfig({
  resolve: {
    alias: [{ find: /^@\//, replacement: `${path.resolve(appRoot)}/` }],
  },
  test: {
    environment: "node",
    include: ["**/*.test.{mjs,ts,tsx}"],
  },
})
