import type { Database } from "@workspace/db"
import {
  knowledgeDocumentChunks,
  knowledgeDocuments,
} from "@workspace/db/schema"
import type {
  KnowledgeDocumentFailureReason,
  KnowledgeDocumentSourceType,
  KnowledgeDocumentStatus,
} from "@workspace/domain"
import { and, desc, eq } from "drizzle-orm"

import { activeKnowledgeDocument } from "./active-document"

export type KnowledgeTx = Parameters<
  Parameters<Database["transaction"]>[0]
>[0]

export type KnowledgeDb = Database | KnowledgeTx

export interface KnowledgeDocumentRecord {
  id: string
  organizationId: string
  title: string
  sourceType: KnowledgeDocumentSourceType
  content: string | null
  sourceName: string | null
  mimeType: string | null
  sourceObjectKey: string | null
  sourceObjectEtag: string | null
  sourceSizeBytes: number | null
  status: KnowledgeDocumentStatus
  failureReason: KnowledgeDocumentFailureReason | null
  revision: number
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface KnowledgeDocumentListItem {
  id: string
  title: string
  sourceType: KnowledgeDocumentSourceType
  sourceName: string | null
  mimeType: string | null
  sourceSizeBytes: number | null
  status: KnowledgeDocumentStatus
  failureReason: KnowledgeDocumentFailureReason | null
  revision: number
  createdAt: Date
  updatedAt: Date
}

export interface KnowledgeDocumentDetailRecord {
  document: KnowledgeDocumentRecord
  previousVersionActive: boolean
}

export function toKnowledgeDocumentRecord(
  row: typeof knowledgeDocuments.$inferSelect
): KnowledgeDocumentRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    title: row.title,
    sourceType: row.sourceType,
    content: row.content,
    sourceName: row.sourceName,
    mimeType: row.mimeType,
    sourceObjectKey: row.sourceObjectKey,
    sourceObjectEtag: row.sourceObjectEtag,
    sourceSizeBytes: row.sourceSizeBytes,
    status: row.status,
    failureReason: row.failureReason,
    revision: row.revision,
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function listKnowledgeDocuments(
  db: KnowledgeDb,
  organizationId: string
): Promise<readonly KnowledgeDocumentListItem[]> {
  return db
    .select({
      id: knowledgeDocuments.id,
      title: knowledgeDocuments.title,
      sourceType: knowledgeDocuments.sourceType,
      sourceName: knowledgeDocuments.sourceName,
      mimeType: knowledgeDocuments.mimeType,
      sourceSizeBytes: knowledgeDocuments.sourceSizeBytes,
      status: knowledgeDocuments.status,
      failureReason: knowledgeDocuments.failureReason,
      revision: knowledgeDocuments.revision,
      createdAt: knowledgeDocuments.createdAt,
      updatedAt: knowledgeDocuments.updatedAt,
    })
    .from(knowledgeDocuments)
    .where(activeKnowledgeDocument(organizationId))
    .orderBy(desc(knowledgeDocuments.updatedAt))
}

export async function getKnowledgeDocument(
  db: KnowledgeDb,
  input: { organizationId: string; documentId: string }
): Promise<KnowledgeDocumentDetailRecord | null> {
  const [document] = await db
    .select()
    .from(knowledgeDocuments)
    .where(
      and(
        activeKnowledgeDocument(input.organizationId),
        eq(knowledgeDocuments.id, input.documentId)
      )
    )
    .limit(1)
  if (!document) return null

  const [chunk] = await db
    .select({ id: knowledgeDocumentChunks.id })
    .from(knowledgeDocumentChunks)
    .where(
      and(
        eq(knowledgeDocumentChunks.organizationId, input.organizationId),
        eq(knowledgeDocumentChunks.knowledgeDocumentId, input.documentId)
      )
    )
    .limit(1)

  return {
    document: toKnowledgeDocumentRecord(document),
    previousVersionActive: chunk !== undefined && document.status !== "ready",
  }
}
