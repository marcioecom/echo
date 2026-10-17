import {
  type KnowledgeDocumentFailureReason,
  type KnowledgeDocumentSourceType,
  type KnowledgeDocumentStatus,
  createId,
} from "@workspace/domain"
import { sql } from "drizzle-orm"
import {
  bigint,
  check,
  customType,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core"

import { organizations, users } from "./auth"

const vector = customType<{ data: string; driverData: string }>({
  dataType: () => "vector(1536)",
})

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}

export const knowledgeDocuments = pgTable(
  "knowledge_documents",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    sourceType: text("source_type")
      .$type<KnowledgeDocumentSourceType>()
      .notNull(),
    content: text("content"),
    sourceName: text("source_name"),
    mimeType: text("mime_type"),
    sourceObjectKey: text("source_object_key"),
    sourceObjectEtag: text("source_object_etag"),
    sourceSizeBytes: bigint("source_size_bytes", { mode: "number" }),
    status: text("status")
      .$type<KnowledgeDocumentStatus>()
      .default("pending")
      .notNull(),
    failureReason:
      text("failure_reason").$type<KnowledgeDocumentFailureReason>(),
    revision: integer("revision").default(1).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    unique("knowledge_documents_organization_id_id_unique").on(
      table.organizationId,
      table.id
    ),
    index("knowledge_documents_organization_status_updated_at_idx").on(
      table.organizationId,
      table.status,
      table.updatedAt
    ),
    index("knowledge_documents_active_organization_updated_at_idx")
      .on(table.organizationId, table.updatedAt)
      .where(sql`${table.deletedAt} is null`),
    check(
      "knowledge_documents_source_check",
      sql`(${table.sourceType} = 'text' and ${table.content} is not null and ${table.sourceName} is null and ${table.mimeType} is null and ${table.sourceObjectKey} is null and ${table.sourceObjectEtag} is null and ${table.sourceSizeBytes} is null) or (${table.sourceType} = 'file' and ${table.sourceName} is not null and ${table.mimeType} is not null and ${table.sourceObjectKey} is not null and ${table.sourceObjectEtag} is not null and ${table.sourceSizeBytes} is not null)`
    ),
  ]
)

export const knowledgeDocumentChunks = pgTable(
  "knowledge_document_chunks",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    knowledgeDocumentId: text("knowledge_document_id").notNull(),
    ordinal: integer("ordinal").notNull(),
    content: text("content").notNull(),
    embeddingModel: text("embedding_model").notNull(),
    embedding: vector("embedding").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "knowledge_document_chunks_document_fk",
      columns: [table.organizationId, table.knowledgeDocumentId],
      foreignColumns: [
        knowledgeDocuments.organizationId,
        knowledgeDocuments.id,
      ],
    }).onDelete("restrict"),
    unique("knowledge_document_chunks_organization_document_ordinal_unique").on(
      table.organizationId,
      table.knowledgeDocumentId,
      table.ordinal
    ),
    index("knowledge_document_chunks_document_idx").on(
      table.organizationId,
      table.knowledgeDocumentId
    ),
    index("knowledge_document_chunks_embedding_hnsw_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops")
    ),
  ]
)

export const knowledgeStorageDeletions = pgTable(
  "knowledge_storage_deletions",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    knowledgeDocumentId: text("knowledge_document_id").notNull(),
    objectKey: text("object_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    unique("knowledge_storage_deletions_object_key_unique").on(table.objectKey),
    foreignKey({
      name: "knowledge_storage_deletions_document_fk",
      columns: [table.organizationId, table.knowledgeDocumentId],
      foreignColumns: [
        knowledgeDocuments.organizationId,
        knowledgeDocuments.id,
      ],
    }).onDelete("restrict"),
    index("knowledge_storage_deletions_pending_idx")
      .on(table.createdAt)
      .where(sql`${table.completedAt} is null`),
  ]
)
