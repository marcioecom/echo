import type { Result } from "@/common/result"
import type { FastifyBaseLogger } from "fastify"

import { retireKnowledgeDocument } from "@workspace/knowledge"

import { err, ok } from "@/common/result"
import { database } from "@/lib/db"

import { enqueueKnowledgeStorageDeletions } from "./enqueue-storage-deletions"

export type DeleteKnowledgeDocumentError = { type: "not_found" }

export async function deleteKnowledgeDocument(input: {
  organizationId: string
  documentId: string
  log: FastifyBaseLogger
}): Promise<Result<{ documentId: string }, DeleteKnowledgeDocumentError>> {
  const result = await retireKnowledgeDocument(database.db, input)
  if (result.outcome === "missing") return err({ type: "not_found" })

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
  return ok({ documentId: input.documentId })
}
