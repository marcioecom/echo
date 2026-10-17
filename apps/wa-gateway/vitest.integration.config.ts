import { fileURLToPath } from "node:url"

process.loadEnvFile(fileURLToPath(new URL("./.env", import.meta.url)))

export { default } from "./vitest.config"
