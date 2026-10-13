import { z } from "zod"

export const knowledgeDocumentUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(255),
  sizeBytes: z.number().int().min(1).max(10_485_760),
})

export const createFileKnowledgeDocumentSchema = z.object({
  title: z.string().trim().min(1).max(255),
  uploadToken: z.string().min(1),
})

export const createTextKnowledgeDocumentSchema = z.object({
  title: z.string().trim().min(1).max(255),
  content: z.string().trim().min(1).max(1_000_000),
})

export const knowledgeDocumentParamsSchema = z.object({
  documentId: z.string().length(26),
})

export const knowledgeDocumentChunkPageSize = 20

export const knowledgeDocumentDetailQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1_000).default(1),
})
