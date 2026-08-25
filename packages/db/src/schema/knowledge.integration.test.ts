import { resolve } from "node:path"

import { PostgreSqlContainer } from "@testcontainers/postgresql"
import { createId } from "@workspace/domain"
import { sql } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createDatabase, type Database } from "../client"
import { knowledgeDocumentChunks, knowledgeDocuments, organizations, users } from "./index"


interface TestDatabase {
  db: Database
  close(): Promise<void>
}
describe("knowledge schema invariants", () => {
  const zeroVector = `[${"0,".repeat(1535)}0]`
  const container = new PostgreSqlContainer("pgvector/pgvector:pg18")
  let database: TestDatabase
  let stop: () => Promise<void>

  beforeAll(async () => {
    const postgres = await container.start()
    stop = () => postgres.stop().then(() => undefined)
    database = createDatabase(postgres.getConnectionUri(), 10_000)
    await database.db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`)
    await migrate(database.db, { migrationsFolder: resolve(process.cwd(), "migrations") })
  }, 60_000)

  afterAll(async () => {
    await Promise.allSettled([database?.close(), stop?.()])
  })

  async function createOwner(slug: string) {
    const organizationId = createId()
    const userId = createId()
    await database.db.insert(organizations).values({
      id: organizationId,
      name: slug,
      slug,
      status: "active",
      createdAt: new Date(),
    })
    await database.db.insert(users).values({
      id: userId,
      name: `${slug} owner`,
      email: `${slug}@example.com`,
    })
    return { organizationId, userId }
  }

  it("defaults a text document to pending revision one", async () => {
    const { organizationId, userId } = await createOwner("knowledge-defaults")
    const [document] = await database.db
      .insert(knowledgeDocuments)
      .values({
        organizationId,
        createdByUserId: userId,
        title: "Support hours",
        sourceType: "text",
        content: "Support is available weekdays.",
      })
      .returning()

    expect(document).toMatchObject({
      organizationId,
      sourceType: "text",
      status: "pending",
      revision: 1,
      failureReason: null,
    })
  })

  it("enforces source metadata and tenant-owned chunks", async () => {
    const first = await createOwner("knowledge-first")
    const second = await createOwner("knowledge-second")

    await expect(
      database.db.insert(knowledgeDocuments).values({
        organizationId: first.organizationId,
        createdByUserId: first.userId,
        title: "Invalid text",
        sourceType: "text",
      })
    ).rejects.toThrow()

    const [document] = await database.db
      .insert(knowledgeDocuments)
      .values({
        organizationId: first.organizationId,
        createdByUserId: first.userId,
        title: "Manual",
        sourceType: "file",
        sourceName: "manual.txt",
        mimeType: "text/plain",
        sourceObjectKey: "knowledge/documents/manual.txt",
        sourceObjectEtag: "etag",
        sourceSizeBytes: 10,
      })
      .returning({ id: knowledgeDocuments.id })
    if (!document) throw new Error("Knowledge fixture document insert returned no row")

    await expect(
      database.db.insert(knowledgeDocumentChunks).values({
        organizationId: second.organizationId,
        knowledgeDocumentId: document.id,
        ordinal: 0,
        content: "Support hours",
        embeddingModel: "openai/text-embedding-3-small",
        embedding: zeroVector,
      })
    ).rejects.toThrow()
  })
})
