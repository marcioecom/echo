import type { DocumentDto } from "./document-dto"
import type { Result } from "@/common/result"

import { err, ok } from "@/common/result"

import { knowledgeDocumentsRepository } from "../repositories/knowledge-documents-repository"
import { safeSourceName, verifyUploadedObject } from "../upload"
import { verifyKnowledgeUploadToken } from "../upload-token"
import { dispatchKnowledgeIndexing } from "./dispatch-indexing"
import { documentDto } from "./document-dto"

export type CreateFileKnowledgeDocumentError =
  | { type: "invalid_upload_token" }
  | { type: "organization_not_found" }
  | { type: "upload_rejected"; status: 404 | 413 | 415 | 503; error: string }
  | { type: "index_dispatch_unavailable"; documentId: string }

export async function createFileKnowledgeDocument(input: {
  organizationId: string
  createdByUserId: string
  title: string
  uploadToken: string
}): Promise<
  Result<{ document: DocumentDto }, CreateFileKnowledgeDocumentError>
> {
  const upload = verifyKnowledgeUploadToken(input.uploadToken)
  if (
    !upload ||
    upload.organizationId !== input.organizationId ||
    upload.createdByUserId !== input.createdByUserId
  ) {
    return err({ type: "invalid_upload_token" })
  }
  if (
    !(await knowledgeDocumentsRepository.hasActiveOrganization(
      upload.organizationId
    ))
  ) {
    return err({ type: "organization_not_found" })
  }

  const existing = await knowledgeDocumentsRepository.findIncludingRetired(
    upload.organizationId,
    upload.uploadId
  )
  if (existing) return ok({ document: documentDto(existing) })

  const verified = await verifyUploadedObject({ upload })
  if (!verified.ok) {
    return err({
      type: "upload_rejected",
      status: verified.status,
      error: verified.error,
    })
  }

  const document = await knowledgeDocumentsRepository.createFile({
    id: upload.uploadId,
    organizationId: upload.organizationId,
    createdByUserId: upload.createdByUserId,
    title: input.title,
    sourceName: safeSourceName(upload.fileName),
    mimeType: upload.contentType,
    sourceObjectKey: upload.objectKey,
    sourceObjectEtag: verified.etag,
    sourceSizeBytes: upload.sizeBytes,
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
