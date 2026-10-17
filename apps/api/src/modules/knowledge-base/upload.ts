import { basename, extname } from "node:path"

import { objectStore } from "@/lib/object-store"

import type { KnowledgeUploadTokenPayload } from "./upload-token"

const maxUploadBytes = 10_485_760

export function safeSourceName(fileName: string): string {
  const extension = extname(fileName).toLowerCase()
  const safeName = basename(fileName)
    .normalize("NFC")
    .replace(/[^A-Za-z0-9._-]/g, "_")
  return safeName.length > 0 && safeName !== extension
    ? safeName
    : `document${extension}`
}

export type AcceptedKnowledgeUpload = {
  ok: true
  etag: string
}

export type RejectedKnowledgeUpload = {
  ok: false
  status: 404 | 413 | 415 | 503
  error: string
}

export async function acceptKnowledgeUpload(input: {
  upload: KnowledgeUploadTokenPayload
  permanentKey: string
}): Promise<AcceptedKnowledgeUpload | RejectedKnowledgeUpload> {
  let head
  try {
    head = await objectStore.head(input.upload.objectKey)
  } catch (error) {
    const status = storageErrorStatus(error)
    return {
      ok: false,
      status,
      error:
        status === 404
          ? "knowledge_uploaded_object_not_found"
          : "knowledge_storage_unavailable",
    }
  }
  if (head.contentLength !== input.upload.sizeBytes) {
    const tooLarge = Boolean(
      head.contentLength && head.contentLength > maxUploadBytes
    )
    return {
      ok: false,
      status: tooLarge ? 413 : 415,
      error: tooLarge
        ? "knowledge_upload_too_large"
        : "knowledge_upload_metadata_mismatch",
    }
  }
  if (head.contentType !== input.upload.contentType || !head.etag) {
    return {
      ok: false,
      status: 415,
      error: "knowledge_upload_metadata_mismatch",
    }
  }
  try {
    await objectStore.copy({
      sourceKey: input.upload.objectKey,
      destinationKey: input.permanentKey,
    })
  } catch {
    return { ok: false, status: 503, error: "knowledge_storage_unavailable" }
  }
  return { ok: true, etag: head.etag }
}

function storageErrorStatus(error: unknown): 404 | 503 {
  if (typeof error !== "object" || error === null || !("$metadata" in error)) {
    return 503
  }
  const metadata = error.$metadata
  if (
    typeof metadata === "object" &&
    metadata !== null &&
    "httpStatusCode" in metadata &&
    metadata.httpStatusCode === 404
  ) {
    return 404
  }
  return 503
}
