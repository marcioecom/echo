import { applyTextPatch } from "@workspace/knowledge"

import { database } from "@/lib/db"

import { dispatchKnowledgeIndexing } from "./dispatch-indexing"

export async function patchKnowledgeDocument(input: {
  organizationId: string
  documentId: string
  title?: string
  content?: string
}) {
  const result = await applyTextPatch(database.db, input)
  if (result.outcome !== "saved" || !result.reindex) return result
  const dispatched = await dispatchKnowledgeIndexing({
    organizationId: result.document.organizationId,
    documentId: result.document.id,
    revision: result.document.revision,
  })
  return { ...result, dispatched }
}
