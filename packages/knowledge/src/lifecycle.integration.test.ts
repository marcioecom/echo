import { resolve } from "node:path"

import { PostgreSqlContainer } from "@testcontainers/postgresql"
import { createDatabase, type Database } from "@workspace/db"
import {
  knowledgeDocumentChunks,
  knowledgeDocuments,
  knowledgeStorageDeletions,
  organizations,
  users,
} from "@workspace/db/schema"
import { createId } from "@workspace/domain"
import { eq, sql } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import {
  applyTextPatch,
  deleteRetiredKnowledgeObject,
  retireKnowledgeDocument,
  runKnowledgeIndexAttempt,
  type ServingChunkSet,
} from "./lifecycle"
import { createRetrieveKnowledge } from "./retrieve-knowledge"

const zeroVector = `[${Array.from({ length: 1536 }, () => 0).join(",")}]`

describe("knowledge document lifecycle", () => {
  const container = new PostgreSqlContainer("pgvector/pgvector:pg18")
  let database: { db: Database; close(): Promise<void> }
  let stop: () => Promise<void>

  beforeAll(async () => {
    const postgres = await container.start()
    stop = () => postgres.stop().then(() => undefined)
    database = createDatabase(postgres.getConnectionUri(), 10_000)
    await database.db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`)
    await migrate(database.db, {
      migrationsFolder: resolve(process.cwd(), "../db/migrations"),
    })
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

  async function insertText(input: {
    organizationId: string
    userId: string
    title: string
    content: string
    status?: "pending" | "processing" | "ready" | "failed"
    revision?: number
  }) {
    const [document] = await database.db
      .insert(knowledgeDocuments)
      .values({
        organizationId: input.organizationId,
        createdByUserId: input.userId,
        title: input.title,
        sourceType: "text",
        content: input.content,
        status: input.status ?? "pending",
        revision: input.revision ?? 1,
      })
      .returning()
    if (!document)
      throw new Error("Knowledge fixture document insert returned no row")
    return document
  }

  async function insertChunk(input: {
    organizationId: string
    documentId: string
    content: string
  }) {
    await database.db.insert(knowledgeDocumentChunks).values({
      organizationId: input.organizationId,
      knowledgeDocumentId: input.documentId,
      ordinal: 0,
      content: input.content,
      embeddingModel: "openai/text-embedding-3-small",
      embedding: zeroVector,
    })
  }

  async function chunkCount(documentId: string) {
    const rows = await database.db
      .select({ id: knowledgeDocumentChunks.id })
      .from(knowledgeDocumentChunks)
      .where(eq(knowledgeDocumentChunks.knowledgeDocumentId, documentId))
    return rows.length
  }

  function chunkSet(input: {
    organizationId: string
    documentId: string
    revision: number
    content: string
  }): ServingChunkSet {
    return {
      organizationId: input.organizationId,
      documentId: input.documentId,
      revision: input.revision,
      sourceType: "text",
      content: null,
      chunks: [
        {
          ordinal: 0,
          content: input.content,
          embeddingModel: "openai/text-embedding-3-small",
          embedding: zeroVector,
        },
      ],
    }
  }

  it("renames files without changing their source or index revision", async () => {
    const owner = await createOwner("kb-file-rename")
    const document = await insertText({
      organizationId: owner.organizationId,
      userId: owner.userId,
      title: "Original",
      content: "Extracted text.",
    })
    const objectKey = `knowledge/documents/${owner.organizationId}/${document.id}/manual.pdf`
    await database.db
      .update(knowledgeDocuments)
      .set({
        sourceType: "file",
        sourceName: "manual.pdf",
        mimeType: "application/pdf",
        sourceObjectKey: objectKey,
        sourceObjectEtag: "etag",
        sourceSizeBytes: 123,
      })
      .where(eq(knowledgeDocuments.id, document.id))

    const renamed = await applyTextPatch(database.db, {
      organizationId: owner.organizationId,
      documentId: document.id,
      title: "Renamed",
    })
    expect(renamed.outcome).toBe("saved")
    if (renamed.outcome !== "saved") throw new Error("File rename did not save")
    expect(renamed.reindex).toBe(false)

    const unchanged = await applyTextPatch(database.db, {
      organizationId: owner.organizationId,
      documentId: document.id,
      title: "Renamed",
    })
    expect(unchanged.outcome).toBe("unchanged")

    const rejectedContent = await applyTextPatch(database.db, {
      organizationId: owner.organizationId,
      documentId: document.id,
      title: "Must not apply",
      content: "Replacement",
    })
    expect(rejectedContent.outcome).toBe("not_text")

    const [stored] = await database.db
      .select()
      .from(knowledgeDocuments)
      .where(eq(knowledgeDocuments.id, document.id))
    expect(stored).toMatchObject({
      title: "Renamed",
      sourceType: "file",
      sourceName: "manual.pdf",
      mimeType: "application/pdf",
      sourceObjectKey: objectKey,
      sourceObjectEtag: "etag",
      sourceSizeBytes: 123,
      revision: document.revision,
      content: "Extracted text.",
    })
  })

  it("retrieves a pending document with chunks and hides a deleted document", async () => {
    const owner = await createOwner("kb-pending")
    const other = await createOwner("kb-other-org")
    const pending = await insertText({
      organizationId: owner.organizationId,
      userId: owner.userId,
      title: "Horário da padaria",
      content: "Texto novo.",
      status: "pending",
      revision: 2,
    })
    const removed = await insertText({
      organizationId: owner.organizationId,
      userId: owner.userId,
      title: "Documento apagado",
      content: "Não volta.",
      status: "ready",
    })
    const foreign = await insertText({
      organizationId: other.organizationId,
      userId: other.userId,
      title: "Segredo da outra loja",
      content: "Outro tenant.",
      status: "ready",
    })
    await insertChunk({
      organizationId: owner.organizationId,
      documentId: pending.id,
      content: "Abrimos de terça a sábado.",
    })
    await insertChunk({
      organizationId: owner.organizationId,
      documentId: removed.id,
      content: "Texto apagado.",
    })
    await insertChunk({
      organizationId: other.organizationId,
      documentId: foreign.id,
      content: "Texto de outra organização.",
    })
    await database.db
      .update(knowledgeDocuments)
      .set({ deletedAt: new Date() })
      .where(eq(knowledgeDocuments.id, removed.id))

    const retrieve = createRetrieveKnowledge({
      database: database.db,
      embedQuery: async () => Array.from({ length: 1536 }, () => 0),
    })
    const snippets = await retrieve({
      organizationId: owner.organizationId,
      query: "horário",
      limit: 6,
    })

    expect(snippets.map((snippet) => snippet.documentId)).toEqual([pending.id])
    expect(snippets[0]?.documentTitle).toBe("Horário da padaria")
  })

  it("does not insert chunks when an index attempt loses to delete", async () => {
    const owner = await createOwner("kb-index-delete")
    const document = await insertText({
      organizationId: owner.organizationId,
      userId: owner.userId,
      title: "Vai sair",
      content: "Texto.",
      status: "pending",
    })
    await insertChunk({
      organizationId: owner.organizationId,
      documentId: document.id,
      content: "Texto.",
    })
    const retired = await retireKnowledgeDocument(database.db, {
      organizationId: owner.organizationId,
      documentId: document.id,
    })
    expect(retired.outcome).toBe("retired")

    const build = vi.fn(() => {
      throw new Error("build should not run")
    })
    await expect(
      runKnowledgeIndexAttempt(
        database.db,
        {
          organizationId: owner.organizationId,
          documentId: document.id,
          revision: document.revision,
          attemptsExhausted: true,
        },
        build
      )
    ).resolves.toBeUndefined()
    expect(build).not.toHaveBeenCalled()
    expect(await chunkCount(document.id)).toBe(0)
  })

  it("drops a chunk set built after the document is retired", async () => {
    const owner = await createOwner("kb-index-race")
    const document = await insertText({
      organizationId: owner.organizationId,
      userId: owner.userId,
      title: "Corrida",
      content: "Texto antigo.",
      status: "pending",
    })
    await insertChunk({
      organizationId: owner.organizationId,
      documentId: document.id,
      content: "Texto antigo.",
    })

    await runKnowledgeIndexAttempt(
      database.db,
      {
        organizationId: owner.organizationId,
        documentId: document.id,
        revision: document.revision,
        attemptsExhausted: true,
      },
      async (current) => {
        await retireKnowledgeDocument(database.db, {
          organizationId: current.organizationId,
          documentId: current.documentId,
        })
        return chunkSet({
          organizationId: current.organizationId,
          documentId: current.documentId,
          revision: current.revision,
          content: "Texto que não pode entrar.",
        })
      }
    )

    expect(await chunkCount(document.id)).toBe(0)
    const [row] = await database.db
      .select({ deletedAt: knowledgeDocuments.deletedAt })
      .from(knowledgeDocuments)
      .where(eq(knowledgeDocuments.id, document.id))
    expect(row?.deletedAt).toBeInstanceOf(Date)
  })

  it("keeps stored chunks when the index attempt fails", async () => {
    const owner = await createOwner("kb-index-fail")
    const document = await insertText({
      organizationId: owner.organizationId,
      userId: owner.userId,
      title: "Falha",
      content: "Texto que permanece.",
      status: "pending",
      revision: 2,
    })
    await insertChunk({
      organizationId: owner.organizationId,
      documentId: document.id,
      content: "Texto que permanece.",
    })

    await expect(
      runKnowledgeIndexAttempt(
        database.db,
        {
          organizationId: owner.organizationId,
          documentId: document.id,
          revision: 2,
          attemptsExhausted: true,
        },
        async () => {
          throw new Error("embedding failed")
        }
      )
    ).rejects.toThrow("embedding failed")

    expect(await chunkCount(document.id)).toBe(1)
    const [row] = await database.db
      .select({
        status: knowledgeDocuments.status,
        failureReason: knowledgeDocuments.failureReason,
        deletedAt: knowledgeDocuments.deletedAt,
      })
      .from(knowledgeDocuments)
      .where(eq(knowledgeDocuments.id, document.id))
    expect(row).toMatchObject({
      status: "failed",
      failureReason: "indexing_failed",
      deletedAt: null,
    })
  })

  it("completes a missing object without clearing the document deletion", async () => {
    const owner = await createOwner("kb-storage")
    const document = await insertText({
      organizationId: owner.organizationId,
      userId: owner.userId,
      title: "Arquivo",
      content: "Texto.",
    })
    await database.db
      .update(knowledgeDocuments)
      .set({
        sourceType: "file",
        content: "Texto.",
        sourceName: "nota.txt",
        mimeType: "text/plain",
        sourceObjectKey: `knowledge/documents/${owner.organizationId}/${document.id}/nota.txt`,
        sourceObjectEtag: "etag",
        sourceSizeBytes: 6,
        deletedAt: new Date(),
      })
      .where(eq(knowledgeDocuments.id, document.id))
    const [deletion] = await database.db
      .insert(knowledgeStorageDeletions)
      .values({
        organizationId: owner.organizationId,
        knowledgeDocumentId: document.id,
        objectKey: `knowledge/documents/${owner.organizationId}/${document.id}/nota.txt`,
      })
      .returning()
    if (!deletion)
      throw new Error("Knowledge storage fixture insert returned no row")
    const removeObject = vi.fn(async () => {
      const error = new Error("missing")
      error.name = "NoSuchKey"
      throw error
    })

    await deleteRetiredKnowledgeObject(database.db, deletion.id, removeObject)
    await deleteRetiredKnowledgeObject(database.db, deletion.id, removeObject)

    const [storedDeletion] = await database.db
      .select({ completedAt: knowledgeStorageDeletions.completedAt })
      .from(knowledgeStorageDeletions)
      .where(eq(knowledgeStorageDeletions.id, deletion.id))
    const [storedDocument] = await database.db
      .select({ deletedAt: knowledgeDocuments.deletedAt })
      .from(knowledgeDocuments)
      .where(eq(knowledgeDocuments.id, document.id))
    expect(removeObject).toHaveBeenCalledTimes(1)
    expect(storedDeletion?.completedAt).toBeInstanceOf(Date)
    expect(storedDocument?.deletedAt).toBeInstanceOf(Date)
  })

  it("leaves the deletion open when the document still serves that object", async () => {
    const owner = await createOwner("kb-live-key")
    const document = await insertText({
      organizationId: owner.organizationId,
      userId: owner.userId,
      title: "Arquivo",
      content: "Texto.",
    })
    const objectKey = `knowledge/documents/${owner.organizationId}/${document.id}/nota.txt`
    await database.db
      .update(knowledgeDocuments)
      .set({
        sourceType: "file",
        content: "Texto.",
        sourceName: "nota.txt",
        mimeType: "text/plain",
        sourceObjectKey: objectKey,
        sourceObjectEtag: "etag",
        sourceSizeBytes: 6,
      })
      .where(eq(knowledgeDocuments.id, document.id))
    const [deletion] = await database.db
      .insert(knowledgeStorageDeletions)
      .values({
        organizationId: owner.organizationId,
        knowledgeDocumentId: document.id,
        objectKey,
      })
      .returning()
    if (!deletion)
      throw new Error("Knowledge storage fixture insert returned no row")
    const removeObject = vi.fn(async () => undefined)

    await expect(
      deleteRetiredKnowledgeObject(database.db, deletion.id, removeObject)
    ).rejects.toThrow("Knowledge storage deletion still names the live object")

    const [storedDeletion] = await database.db
      .select({ completedAt: knowledgeStorageDeletions.completedAt })
      .from(knowledgeStorageDeletions)
      .where(eq(knowledgeStorageDeletions.id, deletion.id))
    expect(removeObject).not.toHaveBeenCalled()
    expect(storedDeletion?.completedAt).toBeNull()
  })
})
