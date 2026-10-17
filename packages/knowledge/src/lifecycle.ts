import {
  knowledgeDocumentChunks,
  knowledgeDocuments,
  knowledgeStorageDeletions,
} from "@workspace/db/schema"
import type { KnowledgeDocumentSourceType } from "@workspace/domain"
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm"

import { activeKnowledgeDocument } from "./active-document"
import {
  getKnowledgeDocument,
  toKnowledgeDocumentRecord,
  type KnowledgeDb,
  type KnowledgeDocumentRecord,
} from "./documents"

export interface ServingChunk {
  ordinal: number
  content: string
  embeddingModel: string
  embedding: string
}

export interface ServingChunkSet {
  organizationId: string
  documentId: string
  revision: number
  sourceType: "text" | "file"
  content: string | null
  chunks: readonly ServingChunk[]
}

export interface IndexableKnowledgeDocument {
  organizationId: string
  documentId: string
  revision: number
  sourceType: KnowledgeDocumentSourceType
  content: string | null
  sourceObjectKey: string | null
  mimeType: string | null
  sourceSizeBytes: number | null
}

export type RetireKnowledgeDocumentResult =
  | { outcome: "missing" }
  | { outcome: "retired"; deletionIds: readonly string[] }

export type TextPatchResult =
  | { outcome: "missing" }
  | { outcome: "not_text" }
  | { outcome: "invalid" }
  | { outcome: "unchanged"; document: KnowledgeDocumentRecord }
  | {
      outcome: "saved"
      document: KnowledgeDocumentRecord
      reindex: boolean
    }

export type FileReplaceResult =
  | { outcome: "missing" }
  | { outcome: "not_file" }
  | {
      outcome: "same_object"
      document: KnowledgeDocumentRecord
      deletionIds: readonly string[]
    }
  | {
      outcome: "replaced"
      document: KnowledgeDocumentRecord
      deletionIds: readonly string[]
    }

async function bumpKnowledgeRevision(
  db: KnowledgeDb,
  input: {
    organizationId: string
    documentId: string
    onlyWhenIdle: boolean
    values: {
      title?: string
      content?: string
      sourceName?: string
      mimeType?: string
      sourceObjectKey?: string
      sourceObjectEtag?: string
      sourceSizeBytes?: number
    }
  }
): Promise<KnowledgeDocumentRecord | null> {
  const [row] = await db
    .update(knowledgeDocuments)
    .set({
      revision: sql`${knowledgeDocuments.revision} + 1`,
      status: "pending",
      failureReason: null,
      ...input.values,
    })
    .where(
      and(
        activeKnowledgeDocument(input.organizationId),
        eq(knowledgeDocuments.id, input.documentId),
        input.onlyWhenIdle
          ? inArray(knowledgeDocuments.status, ["ready", "failed"])
          : undefined
      )
    )
    .returning()
  return row ? toKnowledgeDocumentRecord(row) : null
}

async function insertStorageDeletion(
  db: KnowledgeDb,
  input: {
    organizationId: string
    knowledgeDocumentId: string
    objectKey: string
  }
): Promise<string> {
  const [row] = await db
    .insert(knowledgeStorageDeletions)
    .values(input)
    .onConflictDoUpdate({
      target: knowledgeStorageDeletions.objectKey,
      set: { objectKey: sql`${knowledgeStorageDeletions.objectKey}` },
    })
    .returning({ id: knowledgeStorageDeletions.id })
  if (!row) throw new Error("Knowledge storage deletion insert returned no row")
  return row.id
}

export async function listPendingKnowledgeStorageDeletionIds(
  db: KnowledgeDb,
  filter?: { organizationId: string; documentId: string }
): Promise<readonly string[]> {
  const rows = await db
    .select({ id: knowledgeStorageDeletions.id })
    .from(knowledgeStorageDeletions)
    .where(
      and(
        isNull(knowledgeStorageDeletions.completedAt),
        filter
          ? eq(knowledgeStorageDeletions.organizationId, filter.organizationId)
          : undefined,
        filter
          ? eq(
              knowledgeStorageDeletions.knowledgeDocumentId,
              filter.documentId
            )
          : undefined
      )
    )
    .orderBy(asc(knowledgeStorageDeletions.createdAt))
  return rows.map((row) => row.id)
}

export async function retireKnowledgeDocument(
  db: KnowledgeDb,
  input: { organizationId: string; documentId: string }
): Promise<RetireKnowledgeDocumentResult> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(knowledgeDocuments)
      .where(
        and(
          eq(knowledgeDocuments.organizationId, input.organizationId),
          eq(knowledgeDocuments.id, input.documentId)
        )
      )
      .limit(1)
      .for("update")
    if (!row) return { outcome: "missing" }
    if (row.deletedAt) {
      return {
        outcome: "retired",
        deletionIds: await listPendingKnowledgeStorageDeletionIds(tx, input),
      }
    }

    await tx
      .delete(knowledgeDocumentChunks)
      .where(
        and(
          eq(knowledgeDocumentChunks.organizationId, input.organizationId),
          eq(knowledgeDocumentChunks.knowledgeDocumentId, input.documentId)
        )
      )
    if (row.sourceObjectKey) {
      await insertStorageDeletion(tx, {
        organizationId: input.organizationId,
        knowledgeDocumentId: input.documentId,
        objectKey: row.sourceObjectKey,
      })
    }
    await tx
      .update(knowledgeDocuments)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(knowledgeDocuments.organizationId, input.organizationId),
          eq(knowledgeDocuments.id, input.documentId)
        )
      )
    return {
      outcome: "retired",
      deletionIds: await listPendingKnowledgeStorageDeletionIds(tx, input),
    }
  })
}

export async function applyTextPatch(
  db: KnowledgeDb,
  input: {
    organizationId: string
    documentId: string
    title?: string
    content?: string
  }
): Promise<TextPatchResult> {
  const detail = await getKnowledgeDocument(db, input)
  if (!detail) return { outcome: "missing" }
  if (detail.document.sourceType !== "text") return { outcome: "not_text" }
  if (input.title === undefined && input.content === undefined) {
    return { outcome: "invalid" }
  }

  const nextContent = input.content?.trim()
  if (nextContent !== undefined && nextContent.length === 0) {
    return { outcome: "invalid" }
  }

  const title = input.title ?? detail.document.title
  const contentChanged =
    nextContent !== undefined && nextContent !== detail.document.content
  const titleChanged = title !== detail.document.title
  if (!contentChanged && !titleChanged) {
    return { outcome: "unchanged", document: detail.document }
  }

  if (!contentChanged) {
    const [row] = await db
      .update(knowledgeDocuments)
      .set({ title })
      .where(
        and(
          activeKnowledgeDocument(input.organizationId),
          eq(knowledgeDocuments.id, input.documentId)
        )
      )
      .returning()
    if (!row) return { outcome: "missing" }
    return {
      outcome: "saved",
      document: toKnowledgeDocumentRecord(row),
      reindex: false,
    }
  }

  if (nextContent === undefined) return { outcome: "invalid" }
  const saved = await bumpKnowledgeRevision(db, {
    organizationId: input.organizationId,
    documentId: input.documentId,
    onlyWhenIdle: false,
    values: {
      title,
      content: nextContent,
    },
  })
  if (!saved) return { outcome: "missing" }
  return { outcome: "saved", document: saved, reindex: true }
}

export async function applyFileReplace(
  db: KnowledgeDb,
  input: {
    organizationId: string
    documentId: string
    sourceName: string
    mimeType: string
    sourceObjectKey: string
    sourceObjectEtag: string
    sourceSizeBytes: number
  }
): Promise<FileReplaceResult> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(knowledgeDocuments)
      .where(
        and(
          activeKnowledgeDocument(input.organizationId),
          eq(knowledgeDocuments.id, input.documentId)
        )
      )
      .limit(1)
      .for("update")
    if (!row) return { outcome: "missing" }
    if (row.sourceType !== "file") return { outcome: "not_file" }

    const documentFilter = {
      organizationId: input.organizationId,
      documentId: input.documentId,
    }
    if (row.sourceObjectKey === input.sourceObjectKey) {
      return {
        outcome: "same_object",
        document: toKnowledgeDocumentRecord(row),
        deletionIds: await listPendingKnowledgeStorageDeletionIds(
          tx,
          documentFilter
        ),
      }
    }

    if (row.sourceObjectKey) {
      await insertStorageDeletion(tx, {
        organizationId: input.organizationId,
        knowledgeDocumentId: input.documentId,
        objectKey: row.sourceObjectKey,
      })
    }
    const saved = await bumpKnowledgeRevision(tx, {
      organizationId: input.organizationId,
      documentId: input.documentId,
      onlyWhenIdle: false,
      values: {
        sourceName: input.sourceName,
        mimeType: input.mimeType,
        sourceObjectKey: input.sourceObjectKey,
        sourceObjectEtag: input.sourceObjectEtag,
        sourceSizeBytes: input.sourceSizeBytes,
      },
    })
    if (!saved) return { outcome: "missing" }
    return {
      outcome: "replaced",
      document: saved,
      deletionIds: await listPendingKnowledgeStorageDeletionIds(
        tx,
        documentFilter
      ),
    }
  })
}

export function reindexKnowledgeDocument(
  db: KnowledgeDb,
  input: { organizationId: string; documentId: string }
): Promise<KnowledgeDocumentRecord | null> {
  return bumpKnowledgeRevision(db, {
    organizationId: input.organizationId,
    documentId: input.documentId,
    onlyWhenIdle: true,
    values: {},
  })
}

export async function markIndexDispatchFailed(
  db: KnowledgeDb,
  input: { organizationId: string; documentId: string; revision: number }
): Promise<void> {
  await db
    .update(knowledgeDocuments)
    .set({ status: "failed", failureReason: "index_dispatch_failed" })
    .where(
      and(
        activeKnowledgeDocument(input.organizationId),
        eq(knowledgeDocuments.id, input.documentId),
        eq(knowledgeDocuments.revision, input.revision),
        eq(knowledgeDocuments.status, "pending")
      )
    )
}

async function claimKnowledgeIndex(
  db: KnowledgeDb,
  job: { organizationId: string; documentId: string; revision: number }
): Promise<IndexableKnowledgeDocument | null> {
  const [document] = await db
    .update(knowledgeDocuments)
    .set({ status: "processing", failureReason: null })
    .where(
      and(
        eq(knowledgeDocuments.organizationId, job.organizationId),
        eq(knowledgeDocuments.id, job.documentId),
        eq(knowledgeDocuments.revision, job.revision),
        isNull(knowledgeDocuments.deletedAt),
        inArray(knowledgeDocuments.status, ["pending", "processing"])
      )
    )
    .returning({
      organizationId: knowledgeDocuments.organizationId,
      documentId: knowledgeDocuments.id,
      revision: knowledgeDocuments.revision,
      sourceType: knowledgeDocuments.sourceType,
      content: knowledgeDocuments.content,
      sourceObjectKey: knowledgeDocuments.sourceObjectKey,
      mimeType: knowledgeDocuments.mimeType,
      sourceSizeBytes: knowledgeDocuments.sourceSizeBytes,
    })
  return document ?? null
}

async function failKnowledgeIndex(
  db: KnowledgeDb,
  job: { organizationId: string; documentId: string; revision: number }
): Promise<void> {
  await db
    .update(knowledgeDocuments)
    .set({ status: "failed", failureReason: "indexing_failed" })
    .where(
      and(
        eq(knowledgeDocuments.organizationId, job.organizationId),
        eq(knowledgeDocuments.id, job.documentId),
        eq(knowledgeDocuments.revision, job.revision),
        isNull(knowledgeDocuments.deletedAt),
        eq(knowledgeDocuments.status, "processing")
      )
    )
}

async function publish(
  db: KnowledgeDb,
  set: ServingChunkSet
): Promise<"published" | "skipped"> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        deletedAt: knowledgeDocuments.deletedAt,
        status: knowledgeDocuments.status,
        sourceType: knowledgeDocuments.sourceType,
      })
      .from(knowledgeDocuments)
      .where(
        and(
          eq(knowledgeDocuments.organizationId, set.organizationId),
          eq(knowledgeDocuments.id, set.documentId),
          eq(knowledgeDocuments.revision, set.revision)
        )
      )
      .limit(1)
      .for("update")
    if (!row || row.deletedAt || row.status === "ready") return "skipped"
    if (set.chunks.length === 0) {
      throw new Error("Knowledge index attempt produced no chunks")
    }

    await tx
      .delete(knowledgeDocumentChunks)
      .where(
        and(
          eq(knowledgeDocumentChunks.organizationId, set.organizationId),
          eq(knowledgeDocumentChunks.knowledgeDocumentId, set.documentId)
        )
      )
    await tx.insert(knowledgeDocumentChunks).values(
      set.chunks.map((chunk) => ({
        organizationId: set.organizationId,
        knowledgeDocumentId: set.documentId,
        ordinal: chunk.ordinal,
        content: chunk.content,
        embeddingModel: chunk.embeddingModel,
        embedding: chunk.embedding,
      }))
    )
    await tx
      .update(knowledgeDocuments)
      .set({
        ...(row.sourceType === "file" ? { content: set.content } : {}),
        status: "ready",
        failureReason: null,
      })
      .where(
        and(
          eq(knowledgeDocuments.organizationId, set.organizationId),
          eq(knowledgeDocuments.id, set.documentId),
          eq(knowledgeDocuments.revision, set.revision)
        )
      )
    return "published"
  })
}

export async function runKnowledgeIndexAttempt(
  db: KnowledgeDb,
  job: {
    organizationId: string
    documentId: string
    revision: number
    attemptsExhausted: boolean
  },
  build: (document: IndexableKnowledgeDocument) => Promise<ServingChunkSet>
): Promise<void> {
  const document = await claimKnowledgeIndex(db, job)
  if (!document) return

  try {
    const set = await build(document)
    if (
      set.revision !== job.revision ||
      set.organizationId !== job.organizationId ||
      set.documentId !== job.documentId
    ) {
      throw new Error(
        "Knowledge index attempt built a chunk set for a different document"
      )
    }
    await publish(db, set)
  } catch (error) {
    if (job.attemptsExhausted) await failKnowledgeIndex(db, job)
    throw error
  }
}

function isMissingObject(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false
  if ("name" in error && (error.name === "NoSuchKey" || error.name === "NotFound")) {
    return true
  }
  if (!("$metadata" in error)) return false
  const metadata = error.$metadata
  return (
    typeof metadata === "object" &&
    metadata !== null &&
    "httpStatusCode" in metadata &&
    metadata.httpStatusCode === 404
  )
}

export async function deleteRetiredKnowledgeObject(
  db: KnowledgeDb,
  deletionId: string,
  removeObject: (objectKey: string) => Promise<void>
): Promise<void> {
  const [deletion] = await db
    .select()
    .from(knowledgeStorageDeletions)
    .where(eq(knowledgeStorageDeletions.id, deletionId))
    .limit(1)
  if (!deletion || deletion.completedAt) return

  const [document] = await db
    .select({
      deletedAt: knowledgeDocuments.deletedAt,
      sourceObjectKey: knowledgeDocuments.sourceObjectKey,
    })
    .from(knowledgeDocuments)
    .where(
      and(
        eq(knowledgeDocuments.organizationId, deletion.organizationId),
        eq(knowledgeDocuments.id, deletion.knowledgeDocumentId)
      )
    )
    .limit(1)

  const complete = db
    .update(knowledgeStorageDeletions)
    .set({ completedAt: new Date() })
    .where(
      and(
        eq(knowledgeStorageDeletions.id, deletionId),
        isNull(knowledgeStorageDeletions.completedAt)
      )
    )

  if (
    document &&
    document.deletedAt === null &&
    document.sourceObjectKey === deletion.objectKey
  ) {
    throw new Error("Knowledge storage deletion still names the live object")
  }

  try {
    await removeObject(deletion.objectKey)
  } catch (error) {
    if (!isMissingObject(error)) throw error
  }
  await complete
}
