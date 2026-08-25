import { z } from "zod"

export const knowledgeDocumentSourceTypes = ["text", "file"] as const
export const knowledgeDocumentSourceTypeSchema = z.enum(knowledgeDocumentSourceTypes)
export type KnowledgeDocumentSourceType = z.infer<
  typeof knowledgeDocumentSourceTypeSchema
>

export const knowledgeDocumentStatuses = [
  "pending",
  "processing",
  "ready",
  "failed",
] as const
export const knowledgeDocumentStatusSchema = z.enum(knowledgeDocumentStatuses)
export type KnowledgeDocumentStatus = z.infer<typeof knowledgeDocumentStatusSchema>

export const knowledgeDocumentFailureReasons = [
  "index_dispatch_failed",
  "indexing_failed",
] as const
export const knowledgeDocumentFailureReasonSchema = z.enum(
  knowledgeDocumentFailureReasons
)
export type KnowledgeDocumentFailureReason = z.infer<
  typeof knowledgeDocumentFailureReasonSchema
>
