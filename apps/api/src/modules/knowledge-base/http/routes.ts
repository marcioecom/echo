import { extname } from "node:path"

import { createId } from "@workspace/domain"

import {
  createSupportAgentGraph,
  createSupportAgentModel,
} from "@workspace/agent"
import {
  getKnowledgeDocument,
  listKnowledgeDocuments,
  reindexKnowledgeDocument,
} from "@workspace/knowledge"
import type { FastifyInstance } from "fastify"

import { env } from "@/config/env"
import { database } from "@/lib/db"
import { objectStore } from "@/lib/object-store"
import { guards, getOrganizationAuth } from "@/plugins/auth"
import { getRetrieveKnowledge } from "../embedder"
import { knowledgeDocumentsRepository } from "../repositories/knowledge-documents-repository"
import {
  createFileKnowledgeDocumentSchema,
  createTextKnowledgeDocumentSchema,
  knowledgeDocumentParamsSchema,
  knowledgeDocumentUploadSchema,
  knowledgeTestQuerySchema,
  patchKnowledgeDocumentSchema,
  replaceKnowledgeDocumentFileSchema,
} from "../schemas"
import { acceptKnowledgeUpload, safeSourceName } from "../upload"
import {
  createKnowledgeUploadToken,
  verifyKnowledgeUploadToken,
} from "../upload-token"
import { deleteKnowledgeDocument } from "../use-cases/delete-knowledge-document"
import { dispatchKnowledgeIndexing } from "../use-cases/dispatch-indexing"
import { getKnowledgeDocumentDetail } from "../use-cases/get-knowledge-document-detail"
import { patchKnowledgeDocument } from "../use-cases/patch-knowledge-document"
import { replaceKnowledgeDocumentFile } from "../use-cases/replace-knowledge-document-file"
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

  let previewGraph: ReturnType<typeof createSupportAgentGraph> | undefined

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

      const existing = await knowledgeDocumentsRepository.findIncludingRetired(
        upload.organizationId,
        upload.uploadId
      )
      if (existing) return reply.send({ document: documentDto(existing) })

      const sourceName = safeSourceName(upload.fileName)
      const permanentKey = `knowledge/documents/${upload.organizationId}/${upload.uploadId}/${sourceName}`
      const accepted = await acceptKnowledgeUpload({
        upload,
        permanentKey,
      })
      if (!accepted.ok) {
        return reply.code(accepted.status).send({ error: accepted.error })
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
          sourceObjectEtag: accepted.etag,
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
        await listKnowledgeDocuments(database.db, auth.value.organization.id)
      ).map(documentDto),
    })
  })

  app.get(
    "/v1/knowledge-documents/:documentId",
    { preHandler },
    async (request, reply) => {
      const auth = getOrganizationAuth(request)
      if (!auth.ok)
        return reply.code(403).send({ error: "membership_required" })
      const params = knowledgeDocumentParamsSchema.safeParse(request.params)
      if (!params.success) {
        return reply.code(404).send({ error: "knowledge_document_not_found" })
      }

      const detail = await getKnowledgeDocumentDetail({
        organizationId: auth.value.organization.id,
        documentId: params.data.documentId,
      })
      if (!detail) {
        return reply.code(404).send({ error: "knowledge_document_not_found" })
      }
      return reply.send(detail)
    }
  )

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
      const existing = await getKnowledgeDocument(database.db, {
        organizationId: auth.value.organization.id,
        documentId: params.data.documentId,
      })
      if (!existing)
        return reply.code(404).send({ error: "knowledge_document_not_found" })

      const document = await reindexKnowledgeDocument(database.db, {
        organizationId: auth.value.organization.id,
        documentId: params.data.documentId,
      })
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

  app.patch(
    "/v1/knowledge-documents/:documentId",
    { preHandler },
    async (request, reply) => {
      const auth = getOrganizationAuth(request)
      if (!auth.ok)
        return reply.code(403).send({ error: "membership_required" })
      const params = knowledgeDocumentParamsSchema.safeParse(request.params)
      if (!params.success)
        return reply.code(404).send({ error: "knowledge_document_not_found" })
      const parsed = patchKnowledgeDocumentSchema.safeParse(request.body)
      if (!parsed.success)
        return reply.code(400).send({ error: "invalid_request" })

      const result = await patchKnowledgeDocument({
        organizationId: auth.value.organization.id,
        documentId: params.data.documentId,
        title: parsed.data.title,
        content: parsed.data.content,
      })
      if (result.outcome === "missing")
        return reply.code(404).send({ error: "knowledge_document_not_found" })
      if (result.outcome === "not_text")
        return reply.code(409).send({ error: "knowledge_document_not_text" })
      if (result.outcome === "invalid")
        return reply.code(400).send({ error: "invalid_request" })
      if ("dispatched" in result && !result.dispatched) {
        return reply.code(503).send({
          error: "knowledge_index_dispatch_unavailable",
          documentId: result.document.id,
        })
      }
      return reply.send({ document: documentDto(result.document) })
    }
  )

  app.put(
    "/v1/knowledge-documents/:documentId/file",
    { preHandler },
    async (request, reply) => {
      const auth = getOrganizationAuth(request)
      if (!auth.ok)
        return reply.code(403).send({ error: "membership_required" })
      const params = knowledgeDocumentParamsSchema.safeParse(request.params)
      if (!params.success)
        return reply.code(404).send({ error: "knowledge_document_not_found" })
      const parsed = replaceKnowledgeDocumentFileSchema.safeParse(request.body)
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

      const result = await replaceKnowledgeDocumentFile({
        organizationId: auth.value.organization.id,
        documentId: params.data.documentId,
        upload,
        log: request.log,
      })
      if (result.outcome === "missing")
        return reply.code(404).send({ error: "knowledge_document_not_found" })
      if (result.outcome === "not_file")
        return reply.code(409).send({ error: "knowledge_document_not_file" })
      if (result.outcome === "upload_rejected")
        return reply.code(result.status).send({ error: result.error })
      if (!result.dispatched) {
        return reply.code(503).send({
          error: "knowledge_index_dispatch_unavailable",
          documentId: result.document.id,
        })
      }
      return reply.send({ document: documentDto(result.document) })
    }
  )

  app.delete(
    "/v1/knowledge-documents/:documentId",
    { preHandler },
    async (request, reply) => {
      const auth = getOrganizationAuth(request)
      if (!auth.ok)
        return reply.code(403).send({ error: "membership_required" })
      const params = knowledgeDocumentParamsSchema.safeParse(request.params)
      if (!params.success)
        return reply.code(404).send({ error: "knowledge_document_not_found" })

      const result = await deleteKnowledgeDocument({
        organizationId: auth.value.organization.id,
        documentId: params.data.documentId,
        log: request.log,
      })
      if (result.outcome === "missing")
        return reply.code(404).send({ error: "knowledge_document_not_found" })
      return reply.code(204).send()
    }
  )

  app.post(
    "/v1/knowledge-base/preview-response",
    { preHandler },
    async (request, reply) => {
      const auth = getOrganizationAuth(request)
      if (!auth.ok)
        return reply.code(403).send({ error: "membership_required" })
      const parsed = knowledgeTestQuerySchema.safeParse(request.body)
      if (!parsed.success)
        return reply.code(400).send({ error: "invalid_request" })
      if (!env.AI_GATEWAY_API_KEY)
        return reply.code(503).send({ error: "ai_gateway_unavailable" })
      const retrieve = getRetrieveKnowledge()
      if (!retrieve)
        return reply.code(503).send({ error: "ai_gateway_unavailable" })

      if (!previewGraph) {
        const model = createSupportAgentModel({
          apiKey: env.AI_GATEWAY_API_KEY,
          modelName: env.AI_CHAT_MODEL,
        })
        previewGraph = createSupportAgentGraph(model, retrieve)
      }
      const result = await previewGraph.invoke({
        organizationId: auth.value.organization.id,
        query: parsed.data.question,
        history: [],
      })
      const decision = result.decision
      if (!decision) throw new Error("Support agent returned no decision")
      return reply.send({
        decision,
        hits: (result.snippets ?? []).map((snippet) => ({
          documentId: snippet.documentId,
          title: snippet.documentTitle,
          excerpt: snippet.content,
          score: snippet.similarity,
        })),
      })
    }
  )
}

function validateUploadFile(fileName: string, contentType: string) {
  const extension = extname(fileName).toLowerCase() as keyof typeof allowedFiles
  return allowedFiles[extension] === contentType ? { extension } : null
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
