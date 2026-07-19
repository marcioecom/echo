import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import * as schema from "./schema/index"

export function createDatabase(databaseUrl: string, dependencyTimeoutMs: number) {
  const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: dependencyTimeoutMs,
    query_timeout: dependencyTimeoutMs,
  })
  const db = drizzle(pool, { schema })

  return {
    db,
    pool,
    async check(): Promise<void> {
      await pool.query("select 1")
    },
    async close(): Promise<void> {
      await pool.end()
    },
  }
}

export type Database = ReturnType<typeof createDatabase>["db"]
