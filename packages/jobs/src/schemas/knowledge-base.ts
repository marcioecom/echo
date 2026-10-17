import type { JobsOptions } from "bullmq"
import { ulidSchema } from "@workspace/domain"
import { z } from "zod"

export const knowledgeBaseQueueName = "knowledge-base"

export const knowledgeBaseJobNames = {
  indexKnowledgeDocument: "index-knowledge-document",
  deleteKnowledgeObject: "delete-knowledge-object",
} as const

export const indexKnowledgeDocumentJobSchema = z.object({
  organizationId: ulidSchema,
  documentId: ulidSchema,
  revision: z.number().int().positive(),
})
export type IndexKnowledgeDocumentJob = z.infer<
  typeof indexKnowledgeDocumentJobSchema
>

export const deleteKnowledgeObjectJobSchema = z.object({
  deletionId: ulidSchema,
})
export type DeleteKnowledgeObjectJob = z.infer<
  typeof deleteKnowledgeObjectJobSchema
>

export const deleteKnowledgeObjectJobOptions = {
  attempts: 8,
  backoff: {
    type: "exponential",
    delay: 2_000,
  },
} satisfies JobsOptions
