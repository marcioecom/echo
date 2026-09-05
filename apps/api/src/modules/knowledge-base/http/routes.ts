import { extname, basename } from "node:path"

import { createId } from "@workspace/domain"
import type { FastifyInstance } from "fastify"

import { guards, getOrganizationAuth } from "@/plugins/auth"
import { objectStore } from "@/lib/object-store"
import { dispatchKnowledgeIndexing } from "../use-cases/dispatch-indexing"
import {
  createFileKnowledgeDocumentSchema,
  createTextKnowledgeDocumentSchema,
  knowledgeDocumentParamsSchema,
  knowledgeDocumentUploadSchema,
} from "../schemas"
import { knowledgeDocumentsRepository } from "../repositories/knowledge-documents-repository"
import {
  createKnowledgeUploadToken,
  verifyKnowledgeUploadToken,
} from "../upload-token"

const maxUploadBytes = 10_485_760
const uploadExpiresInSeconds = 900
const allowedFiles = {
  ".pdf": "application/pdf",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".md": "text/markdown",
  ".markdown": "text/markdown",
  ".txt": "text/plain",
} as const

export function registerKnowledgeBaseRoutes(app: FastifyInstance): void {
  const preHandler = [
    guards.requireUser,
    guards.requireMembership({ roles: ["owner", "admin"] }),
  ]

  app.post(
    "/v1/knowledge-document-uploads",
    { preHandler },
    async (request, reply) => {
      const auth = getOrganizationAuth(request)
      if (!auth.ok)
        return reply.code(403).send({ error: "membership_required" })
      const parsed = knowledgeDocumentUploadSchema.safeParse(request.body)
      if (!parsed.success)
        return reply.code(400).send({ error: "invalid_request" })
      const file = validateUploadFile(
        parsed.data.fileName,
        parsed.data.contentType
      )
      if (!file)
        return reply
          .code(415)
          .send({ error: "knowledge_unsupported_file_type" })
      if (
        !(await knowledgeDocumentsRepository.hasActiveOrganization(
          auth.value.organization.id
        ))
      ) {
        return reply.code(404).send({ error: "organization_not_found" })
      }

      const uploadId = createId()
      const objectKey = `knowledge/uploads/${auth.value.organization.id}/${uploadId}${file.extension}`
      const expiresAt = Date.now() + uploadExpiresInSeconds * 1_000
      const uploadUrl = await objectStore.presignPut({
        key: objectKey,
        contentType: parsed.data.contentType,
        expiresIn: uploadExpiresInSeconds,
      })
      const uploadToken = createKnowledgeUploadToken({
        uploadId,
        organizationId: auth.value.organization.id,
        createdByUserId: auth.value.user.id,
        fileName: parsed.data.fileName,
        contentType: parsed.data.contentType,
        sizeBytes: parsed.data.sizeBytes,
        objectKey,
        expiresAt,
      })

      return reply.code(201).send({
        uploadUrl: uploadUrl.url,
        uploadToken,
        expiresAt: new Date(expiresAt).toISOString(),
        headers: uploadUrl.headers,
      })
    }
  )

  app.post(
    "/v1/knowledge-documents/file",
    { preHandler },
    async (request, reply) => {
      const auth = getOrganizationAuth(request)
      if (!auth.ok)
        return reply.code(403).send({ error: "membership_required" })
      const parsed = createFileKnowledgeDocumentSchema.safeParse(request.body)
      if (!parsed.success)
        return reply.code(400).send({ error: "invalid_request" })
      const upload = verifyKnowledgeUploadToken(parsed.data.uploadToken)
      if (
        !upload ||
        upload.organizationId !== auth.value.organization.id ||
        upload.createdByUserId !== auth.value.user.id
      ) {
        return reply.code(400).send({ error: "invalid_upload_token" })
      }
      if (
        !(await knowledgeDocumentsRepository.hasActiveOrganization(
          upload.organizationId
        ))
      ) {
        return reply.code(404).send({ error: "organization_not_found" })
      }

      const existing = await knowledgeDocumentsRepository.find(
        upload.organizationId,
        upload.uploadId
      )
      if (existing) return reply.send({ document: documentDto(existing) })

      let head
      try {
        head = await objectStore.head(upload.objectKey)
      } catch (error) {
        return reply.code(storageErrorStatus(error)).send({
          error:
            storageErrorStatus(error) === 404
              ? "knowledge_uploaded_object_not_found"
              : "knowledge_storage_unavailable",
        })
      }
      if (head.contentLength !== upload.sizeBytes) {
        return reply
          .code(
            head.contentLength && head.contentLength > maxUploadBytes
              ? 413
              : 415
          )
          .send({
            error:
              head.contentLength && head.contentLength > maxUploadBytes
                ? "knowledge_upload_too_large"
                : "knowledge_upload_metadata_mismatch",
          })
      }
      if (head.contentType !== upload.contentType || !head.etag) {
        return reply
          .code(415)
          .send({ error: "knowledge_upload_metadata_mismatch" })
      }

      const sourceName = safeSourceName(upload.fileName)
      const permanentKey = `knowledge/documents/${upload.organizationId}/${upload.uploadId}/${sourceName}`
      try {
        await objectStore.copy({
          sourceKey: upload.objectKey,
          destinationKey: permanentKey,
        })
      } catch {
        return reply.code(503).send({ error: "knowledge_storage_unavailable" })
      }

      let document
      try {
        document = await knowledgeDocumentsRepository.createFile({
          id: upload.uploadId,
          organizationId: upload.organizationId,
          createdByUserId: upload.createdByUserId,
          title: parsed.data.title,
          sourceName,
          mimeType: upload.contentType,
          sourceObjectKey: permanentKey,
          sourceObjectEtag: head.etag,
          sourceSizeBytes: upload.sizeBytes,
        })
      } catch (error) {
        await objectStore.delete(permanentKey).catch(() => undefined)
        throw error
      }

      await objectStore.delete(upload.objectKey).catch((error: unknown) => {
        request.log.warn(
          { err: error, documentId: document.id },
          "Knowledge upload cleanup failed"
        )
      })
      if (
        !(await dispatchKnowledgeIndexing({
          organizationId: document.organizationId,
          documentId: document.id,
          revision: document.revision,
        }))
      ) {
        return reply.code(503).send({
          error: "knowledge_index_dispatch_unavailable",
          documentId: document.id,
        })
      }
      return reply.code(201).send({ document: documentDto(document) })
    }
  )

  app.post(
    "/v1/knowledge-documents/text",
    { preHandler },
    async (request, reply) => {
      const auth = getOrganizationAuth(request)
      if (!auth.ok)
        return reply.code(403).send({ error: "membership_required" })
      const parsed = createTextKnowledgeDocumentSchema.safeParse(request.body)
      if (!parsed.success)
        return reply.code(400).send({ error: "invalid_request" })
      if (
        !(await knowledgeDocumentsRepository.hasActiveOrganization(
          auth.value.organization.id
        ))
      ) {
        return reply.code(404).send({ error: "organization_not_found" })
      }

      const document = await knowledgeDocumentsRepository.createText({
        organizationId: auth.value.organization.id,
        createdByUserId: auth.value.user.id,
        title: parsed.data.title,
        content: parsed.data.content.trim(),
      })
      if (
        !(await dispatchKnowledgeIndexing({
          organizationId: document.organizationId,
          documentId: document.id,
          revision: document.revision,
        }))
      ) {
        return reply.code(503).send({
          error: "knowledge_index_dispatch_unavailable",
          documentId: document.id,
        })
      }
      return reply.code(201).send({ document: documentDto(document) })
    }
  )

  app.get("/v1/knowledge-documents", { preHandler }, async (request, reply) => {
    const auth = getOrganizationAuth(request)
    if (!auth.ok) return reply.code(403).send({ error: "membership_required" })
    return reply.send({
      items: (
        await knowledgeDocumentsRepository.list(auth.value.organization.id)
      ).map(documentDto),
    })
  })

  app.post(
    "/v1/knowledge-documents/:documentId/reindex",
    { preHandler },
    async (request, reply) => {
      const auth = getOrganizationAuth(request)
      if (!auth.ok)
        return reply.code(403).send({ error: "membership_required" })
      const params = knowledgeDocumentParamsSchema.safeParse(request.params)
      if (!params.success)
        return reply.code(404).send({ error: "knowledge_document_not_found" })
      const existing = await knowledgeDocumentsRepository.find(
        auth.value.organization.id,
        params.data.documentId
      )
      if (!existing)
        return reply.code(404).send({ error: "knowledge_document_not_found" })
      if (existing.status === "pending" || existing.status === "processing") {
        return reply.code(409).send({ error: "knowledge_document_indexing" })
      }

      const document = await knowledgeDocumentsRepository.queueReindex(
        auth.value.organization.id,
        existing.id
      )
      if (!document)
        return reply.code(409).send({ error: "knowledge_document_indexing" })
      if (
        !(await dispatchKnowledgeIndexing({
          organizationId: document.organizationId,
          documentId: document.id,
          revision: document.revision,
        }))
      ) {
        return reply.code(503).send({
          error: "knowledge_index_dispatch_unavailable",
          documentId: document.id,
        })
      }
      return reply.send({ document: documentDto(document) })
    }
  )
}

function validateUploadFile(fileName: string, contentType: string) {
  const extension = extname(fileName).toLowerCase() as keyof typeof allowedFiles
  return allowedFiles[extension] === contentType ? { extension } : null
}

function safeSourceName(fileName: string): string {
  const extension = extname(fileName).toLowerCase()
  const safeName = basename(fileName)
    .normalize("NFC")
    .replace(/[^A-Za-z0-9._-]/g, "_")
  return safeName.length > 0 && safeName !== extension
    ? safeName
    : `document${extension}`
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

function documentDto(document: {
  id: string
  title: string
  sourceType: string
  sourceName: string | null
  mimeType: string | null
  sourceSizeBytes: number | null
  status: string
  failureReason: string | null
  revision: number
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: document.id,
    title: document.title,
    sourceType: document.sourceType,
    sourceName: document.sourceName,
    mimeType: document.mimeType,
    sourceSizeBytes: document.sourceSizeBytes,
    status: document.status,
    failureReason: document.failureReason,
    revision: document.revision,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  }
}
