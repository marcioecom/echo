import { ulidSchema } from "@workspace/domain"
import { z } from "zod"

export const knowledgeBaseQueueName = "knowledge-base"

export const knowledgeBaseJobNames = {
  indexKnowledgeDocument: "index-knowledge-document",
} as const

export const indexKnowledgeDocumentJobSchema = z.object({
  organizationId: ulidSchema,
  documentId: ulidSchema,
  revision: z.number().int().positive(),
})
export type IndexKnowledgeDocumentJob = z.infer<
  typeof indexKnowledgeDocumentJobSchema
>
