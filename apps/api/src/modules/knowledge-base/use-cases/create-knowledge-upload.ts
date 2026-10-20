import type { Result } from "@/common/result"

import { createId } from "@workspace/domain"

import { err, ok } from "@/common/result"
import { objectStore } from "@/lib/object-store"

import { knowledgeDocumentsRepository } from "../repositories/knowledge-documents-repository"
import {
  safeSourceName,
  uploadExpiresInSeconds,
  validateUploadFile,
} from "../upload"
import { createKnowledgeUploadToken } from "../upload-token"

export type CreateKnowledgeUploadError =
  | { type: "knowledge_unsupported_file_type" }
  | { type: "organization_not_found" }

export type CreateKnowledgeUploadResult = {
  uploadUrl: string
  uploadToken: string
  expiresAt: string
  headers: { "Content-Type": string }
}

export async function createKnowledgeUpload(input: {
  organizationId: string
  createdByUserId: string
  fileName: string
  contentType: string
  sizeBytes: number
}): Promise<Result<CreateKnowledgeUploadResult, CreateKnowledgeUploadError>> {
  if (!validateUploadFile(input.fileName, input.contentType)) {
    return err({ type: "knowledge_unsupported_file_type" })
  }
  if (
    !(await knowledgeDocumentsRepository.hasActiveOrganization(
      input.organizationId
    ))
  ) {
    return err({ type: "organization_not_found" })
  }

  const uploadId = createId()
  const objectKey = `knowledge/documents/${input.organizationId}/${uploadId}/${safeSourceName(input.fileName)}`
  const expiresAt = Date.now() + uploadExpiresInSeconds * 1_000
  const uploadUrl = await objectStore.presignPut({
    key: objectKey,
    contentType: input.contentType,
    expiresIn: uploadExpiresInSeconds,
  })
  const uploadToken = createKnowledgeUploadToken({
    uploadId,
    organizationId: input.organizationId,
    createdByUserId: input.createdByUserId,
    fileName: input.fileName,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
    objectKey,
    expiresAt,
  })

  return ok({
    uploadUrl: uploadUrl.url,
    uploadToken,
    expiresAt: new Date(expiresAt).toISOString(),
    headers: uploadUrl.headers,
  })
}
