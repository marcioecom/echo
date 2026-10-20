import type { DocumentDto } from "./document-dto"
import type { Result } from "@/common/result"

import {
  getKnowledgeDocument,
  reindexKnowledgeDocument as reindexKnowledgeDocumentRecord,
} from "@workspace/knowledge"

import { err, ok } from "@/common/result"
import { database } from "@/lib/db"

import { dispatchKnowledgeIndexing } from "./dispatch-indexing"
import { documentDto } from "./document-dto"

export type ReindexKnowledgeDocumentError =
  | { type: "not_found" }
  | { type: "indexing" }
  | { type: "index_dispatch_unavailable"; documentId: string }

export async function reindexKnowledgeDocument(input: {
  organizationId: string
  documentId: string
}): Promise<Result<{ document: DocumentDto }, ReindexKnowledgeDocumentError>> {
  const document = await reindexKnowledgeDocumentRecord(database.db, input)
  if (!document) {
    const existing = await getKnowledgeDocument(database.db, input)
    return err(existing ? { type: "indexing" } : { type: "not_found" })
  }

  if (
    !(await dispatchKnowledgeIndexing({
      organizationId: document.organizationId,
      documentId: document.id,
      revision: document.revision,
    }))
  ) {
    return err({ type: "index_dispatch_unavailable", documentId: document.id })
  }

  return ok({ document: documentDto(document) })
}
