import {
  applyFileReplace,
  getKnowledgeDocument,
  listPendingKnowledgeStorageDeletionIds,
  type KnowledgeDocumentRecord,
} from "@workspace/knowledge"
import type { FastifyBaseLogger } from "fastify"

import { database } from "@/lib/db"
import { objectStore } from "@/lib/object-store"

import { acceptKnowledgeUpload, safeSourceName } from "../upload"
import type { KnowledgeUploadTokenPayload } from "../upload-token"
import { dispatchKnowledgeIndexing } from "./dispatch-indexing"
import { enqueueKnowledgeStorageDeletions } from "./enqueue-storage-deletions"

export async function replaceKnowledgeDocumentFile(input: {
  organizationId: string
  documentId: string
  upload: KnowledgeUploadTokenPayload
  log: FastifyBaseLogger
}) {
  const sourceName = safeSourceName(input.upload.fileName)
  const permanentKey = `knowledge/documents/${input.organizationId}/${input.documentId}/${input.upload.uploadId}/${sourceName}`
  const current = await getKnowledgeDocument(database.db, {
    organizationId: input.organizationId,
    documentId: input.documentId,
  })
  if (!current) return { outcome: "missing" as const }
  if (current.document.sourceType !== "file") return { outcome: "not_file" as const }

  if (current.document.sourceObjectKey === permanentKey) {
    return finishSameObject({
      document: current.document,
      log: input.log,
    })
  }

  const accepted = await acceptKnowledgeUpload({
    upload: input.upload,
    permanentKey,
  })
  if (!accepted.ok) {
    return {
      outcome: "upload_rejected" as const,
      status: accepted.status,
      error: accepted.error,
    }
  }

  let result
  try {
    result = await applyFileReplace(database.db, {
      organizationId: input.organizationId,
      documentId: input.documentId,
      sourceName,
      mimeType: input.upload.contentType,
      sourceObjectKey: permanentKey,
      sourceObjectEtag: accepted.etag,
      sourceSizeBytes: input.upload.sizeBytes,
    })
  } catch (error) {
    await objectStore.delete(permanentKey).catch(() => undefined)
    throw error
  }

  if (result.outcome === "same_object") {
    return finishSameObject({
      document: result.document,
      deletionIds: result.deletionIds,
      log: input.log,
    })
  }
  if (result.outcome !== "replaced") {
    await objectStore.delete(permanentKey).catch(() => undefined)
    return result
  }

  await enqueueDeletionIds(result.deletionIds, input.log, input.documentId)
  const dispatched = await dispatchKnowledgeIndexing({
    organizationId: result.document.organizationId,
    documentId: result.document.id,
    revision: result.document.revision,
  })
  return { outcome: "replaced" as const, document: result.document, dispatched }
}

async function finishSameObject(input: {
  document: KnowledgeDocumentRecord
  deletionIds?: readonly string[]
  log: FastifyBaseLogger
}) {
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
  return {
    outcome: "same_object" as const,
    document: input.document,
    dispatched,
  }
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
