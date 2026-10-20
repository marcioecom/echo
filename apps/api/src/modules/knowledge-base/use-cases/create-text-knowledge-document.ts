import type { DocumentDto } from "./document-dto"
import type { Result } from "@/common/result"

import { err, ok } from "@/common/result"

import { knowledgeDocumentsRepository } from "../repositories/knowledge-documents-repository"
import { dispatchKnowledgeIndexing } from "./dispatch-indexing"
import { documentDto } from "./document-dto"

export type CreateTextKnowledgeDocumentError =
  | { type: "organization_not_found" }
  | { type: "index_dispatch_unavailable"; documentId: string }

export async function createTextKnowledgeDocument(input: {
  organizationId: string
  createdByUserId: string
  title: string
  content: string
}): Promise<
  Result<{ document: DocumentDto }, CreateTextKnowledgeDocumentError>
> {
  if (
    !(await knowledgeDocumentsRepository.hasActiveOrganization(
      input.organizationId
    ))
  ) {
    return err({ type: "organization_not_found" })
  }

  const document = await knowledgeDocumentsRepository.createText({
    organizationId: input.organizationId,
    createdByUserId: input.createdByUserId,
    title: input.title,
    content: input.content.trim(),
  })

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
