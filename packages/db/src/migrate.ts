import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { migrate } from "drizzle-orm/node-postgres/migrator"

import { createDatabase, type DatabaseClient } from "./client"

const migrationsFolder = "migrations"
const migrationsSchema = "drizzle"
const migrationsTable = "__drizzle_migrations"

type JournalEntry = {
  idx: number
  when: number
  tag: string
}

const databaseUrl = process.env.DATABASE_URL
const dependencyTimeoutMs = Number(process.env.DEPENDENCY_TIMEOUT_MS)

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required")
}

if (!Number.isInteger(dependencyTimeoutMs) || dependencyTimeoutMs <= 0) {
  throw new Error("DEPENDENCY_TIMEOUT_MS must be a positive integer")
}

function describeMigrations(count: number): string {
  return `${count} migration${count === 1 ? "" : "s"}`
}

async function readJournal(): Promise<JournalEntry[]> {
  const file = join(migrationsFolder, "meta", "_journal.json")
  const raw = await readFile(file, "utf8")
  const journal = JSON.parse(raw) as { entries: JournalEntry[] }

  return journal.entries
}

async function readLastAppliedAt(pool: DatabaseClient["pool"]): Promise<number | null> {
  const existence = await pool.query<{ present: boolean }>(
    "select to_regclass($1) is not null as present",
    [`${migrationsSchema}.${migrationsTable}`],
  )

  if (!existence.rows[0]?.present) {
    return null
  }

  const result = await pool.query<{ last_applied_at: string | null }>(
    `select max(created_at) as last_applied_at from "${migrationsSchema}"."${migrationsTable}"`,
  )
  const value = result.rows[0]?.last_applied_at

  return value === null || value === undefined ? null : Number(value)
}

const database = createDatabase(databaseUrl, dependencyTimeoutMs)

try {
  const entries = await readJournal()
  const lastAppliedAt = await readLastAppliedAt(database.pool)
  const pending = entries.filter((entry) => lastAppliedAt === null || entry.when > lastAppliedAt)

  if (pending.length === 0) {
    console.log(`Nothing to apply. ${describeMigrations(entries.length)} already applied.`)
  } else {
    console.log(`Applying ${describeMigrations(pending.length)}:`)
    for (const entry of pending) {
      console.log(`  - ${entry.tag}`)
    }

    const startedAt = Date.now()
    await migrate(database.db, { migrationsFolder, migrationsSchema, migrationsTable })

    console.log(`Applied ${describeMigrations(pending.length)} in ${Date.now() - startedAt}ms.`)
  }
} finally {
  await database.close()
}
