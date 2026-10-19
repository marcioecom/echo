import { applyTextPatch } from "@workspace/knowledge"

import { err, ok, type Result } from "@/common/result"
import { database } from "@/lib/db"

import { dispatchKnowledgeIndexing } from "./dispatch-indexing"
import { documentDto, type DocumentDto } from "./document-dto"

export type PatchKnowledgeDocumentError =
  | { type: "not_found" }
  | { type: "not_text" }
  | { type: "invalid" }
  | { type: "index_dispatch_unavailable"; documentId: string }

export async function patchKnowledgeDocument(input: {
  organizationId: string
  documentId: string
  title?: string
  content?: string
}): Promise<Result<{ document: DocumentDto }, PatchKnowledgeDocumentError>> {
  const result = await applyTextPatch(database.db, input)
  if (result.outcome === "missing") return err({ type: "not_found" })
  if (result.outcome === "not_text") return err({ type: "not_text" })
  if (result.outcome === "invalid") return err({ type: "invalid" })
  if (result.outcome === "unchanged" || !result.reindex) {
    return ok({ document: documentDto(result.document) })
  }

  if (
    !(await dispatchKnowledgeIndexing({
      organizationId: result.document.organizationId,
      documentId: result.document.id,
      revision: result.document.revision,
    }))
  ) {
    return err({
      type: "index_dispatch_unavailable",
      documentId: result.document.id,
    })
  }

  return ok({ document: documentDto(result.document) })
}
