import { migrate } from "drizzle-orm/node-postgres/migrator"

import { createDatabase } from "./client"

const databaseUrl = process.env.DATABASE_URL
const dependencyTimeoutMs = Number(process.env.DEPENDENCY_TIMEOUT_MS)

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required")
}

if (!Number.isInteger(dependencyTimeoutMs) || dependencyTimeoutMs <= 0) {
  throw new Error("DEPENDENCY_TIMEOUT_MS must be a positive integer")
}

const database = createDatabase(databaseUrl, dependencyTimeoutMs)

try {
  await migrate(database.db, { migrationsFolder: "migrations" })
} finally {
  await database.close()
}
