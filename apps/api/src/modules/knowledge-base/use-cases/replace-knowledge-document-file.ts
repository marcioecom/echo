import {
  applyFileReplace,
  getKnowledgeDocument,
  listPendingKnowledgeStorageDeletionIds,
  type KnowledgeDocumentRecord,
} from "@workspace/knowledge"
import type { FastifyBaseLogger } from "fastify"

import { err, ok, type Result } from "@/common/result"
import { database } from "@/lib/db"

import { knowledgeDocumentsRepository } from "../repositories/knowledge-documents-repository"
import { safeSourceName, verifyUploadedObject } from "../upload"
import { verifyKnowledgeUploadToken } from "../upload-token"
import { dispatchKnowledgeIndexing } from "./dispatch-indexing"
import { documentDto, type DocumentDto } from "./document-dto"
import { enqueueKnowledgeStorageDeletions } from "./enqueue-storage-deletions"

export type ReplaceKnowledgeDocumentFileError =
  | { type: "invalid_upload_token" }
  | { type: "organization_not_found" }
  | { type: "not_found" }
  | { type: "not_file" }
  | { type: "upload_rejected"; status: 404 | 413 | 415 | 503; error: string }
  | { type: "index_dispatch_unavailable"; documentId: string }

export async function replaceKnowledgeDocumentFile(input: {
  organizationId: string
  createdByUserId: string
  documentId: string
  uploadToken: string
  log: FastifyBaseLogger
}): Promise<
  Result<{ document: DocumentDto }, ReplaceKnowledgeDocumentFileError>
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

  const sourceName = safeSourceName(upload.fileName)
  const permanentKey = upload.objectKey
  const current = await getKnowledgeDocument(database.db, {
    organizationId: input.organizationId,
    documentId: input.documentId,
  })
  if (!current) return err({ type: "not_found" })
  if (current.document.sourceType !== "file") return err({ type: "not_file" })

  if (current.document.sourceObjectKey === permanentKey) {
    return finishSameObject({
      document: current.document,
      log: input.log,
    })
  }

  const verified = await verifyUploadedObject({ upload })
  if (!verified.ok) {
    return err({
      type: "upload_rejected",
      status: verified.status,
      error: verified.error,
    })
  }

  const result = await applyFileReplace(database.db, {
    organizationId: input.organizationId,
    documentId: input.documentId,
    sourceName,
    mimeType: upload.contentType,
    sourceObjectKey: permanentKey,
    sourceObjectEtag: verified.etag,
    sourceSizeBytes: upload.sizeBytes,
  })

  if (result.outcome === "same_object") {
    return finishSameObject({
      document: result.document,
      deletionIds: result.deletionIds,
      log: input.log,
    })
  }
  if (result.outcome === "missing") return err({ type: "not_found" })
  if (result.outcome === "not_file") return err({ type: "not_file" })

  await enqueueDeletionIds(result.deletionIds, input.log, input.documentId)
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

async function finishSameObject(input: {
  document: KnowledgeDocumentRecord
  deletionIds?: readonly string[]
  log: FastifyBaseLogger
}): Promise<
  Result<{ document: DocumentDto }, ReplaceKnowledgeDocumentFileError>
> {
  const deletionIds =
    input.deletionIds ??
    (await listPendingKnowledgeStorageDeletionIds(database.db, {
      organizationId: input.document.organizationId,
      documentId: input.document.id,
    }))
  await enqueueDeletionIds(deletionIds, input.log, input.document.id)
  const shouldDispatch =
    input.document.status === "pending" ||
    input.document.failureReason === "index_dispatch_failed"
  const dispatched = shouldDispatch
    ? await dispatchKnowledgeIndexing({
        organizationId: input.document.organizationId,
        documentId: input.document.id,
        revision: input.document.revision,
      })
    : true
  if (!dispatched) {
    return err({
      type: "index_dispatch_unavailable",
      documentId: input.document.id,
    })
  }
  return ok({ document: documentDto(input.document) })
}

async function enqueueDeletionIds(
  deletionIds: readonly string[],
  log: FastifyBaseLogger,
  documentId: string
) {
  try {
    await enqueueKnowledgeStorageDeletions(deletionIds)
  } catch (error) {
    log.error(
      { err: error, documentId },
      "Knowledge storage deletion enqueue failed"
    )
  }
}
