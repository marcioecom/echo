import { retireKnowledgeDocument } from "@workspace/knowledge"
import type { FastifyBaseLogger } from "fastify"

import { database } from "@/lib/db"

import { enqueueKnowledgeStorageDeletions } from "./enqueue-storage-deletions"

export async function deleteKnowledgeDocument(input: {
  organizationId: string
  documentId: string
  log: FastifyBaseLogger
}) {
  const result = await retireKnowledgeDocument(database.db, input)
  if (result.outcome === "missing") return result
  try {
    await enqueueKnowledgeStorageDeletions(result.deletionIds)
  } catch (error) {
    input.log.error(
      {
        err: error,
        organizationId: input.organizationId,
        documentId: input.documentId,
      },
      "Knowledge storage deletion enqueue failed"
    )
  }
  return result
}
