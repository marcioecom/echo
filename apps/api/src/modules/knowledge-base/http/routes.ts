import type { AppInstance } from "@/lib/fastify"

import { matchResult, matchTag } from "@/common/match"
import { guards, organizationAuth } from "@/plugins/auth"

import {
  createFileKnowledgeDocumentSchema,
  createTextKnowledgeDocumentSchema,
  knowledgeDocumentParamsSchema,
  knowledgeDocumentUploadSchema,
  knowledgeTestBodySchema,
  patchKnowledgeDocumentSchema,
  replaceKnowledgeDocumentFileSchema,
} from "../schemas"
import { createFileKnowledgeDocument } from "../use-cases/create-file-knowledge-document"
import { createKnowledgeUpload } from "../use-cases/create-knowledge-upload"
import { createTextKnowledgeDocument } from "../use-cases/create-text-knowledge-document"
import { deleteKnowledgeDocument } from "../use-cases/delete-knowledge-document"
import { getKnowledgeDocumentDetail } from "../use-cases/get-knowledge-document-detail"
import { listKnowledgeDocuments } from "../use-cases/list-knowledge-documents"
import { patchKnowledgeDocument } from "../use-cases/patch-knowledge-document"
import { previewKnowledgeResponse } from "../use-cases/preview-knowledge-response"
import { reindexKnowledgeDocument } from "../use-cases/reindex-knowledge-document"
import { replaceKnowledgeDocumentFile } from "../use-cases/replace-knowledge-document-file"

export function registerKnowledgeBaseRoutes(app: AppInstance): void {
  const preHandler = guards.requireOrganization({ roles: ["owner", "admin"] })

  app.post(
    "/v1/knowledge-document-uploads",
    { preHandler, schema: { body: knowledgeDocumentUploadSchema } },
    async (request, reply) => {
      const auth = organizationAuth(request)
      const result = await createKnowledgeUpload({
        organizationId: auth.organization.id,
        createdByUserId: auth.user.id,
        fileName: request.body.fileName,
        contentType: request.body.contentType,
        sizeBytes: request.body.sizeBytes,
      })

      return matchResult(result, {
        err: (error) =>
          matchTag(error, {
            knowledge_unsupported_file_type: () =>
              reply
                .code(415)
                .send({ error: "knowledge_unsupported_file_type" }),
            organization_not_found: () =>
              reply.code(404).send({ error: "organization_not_found" }),
          }),
        ok: (value) => reply.code(201).send(value),
      })
    }
  )

  app.post(
    "/v1/knowledge-documents/file",
    { preHandler, schema: { body: createFileKnowledgeDocumentSchema } },
    async (request, reply) => {
      const auth = organizationAuth(request)
      const result = await createFileKnowledgeDocument({
        organizationId: auth.organization.id,
        createdByUserId: auth.user.id,
        title: request.body.title,
        uploadToken: request.body.uploadToken,
      })

      return matchResult(result, {
        err: (error) =>
          matchTag(error, {
            invalid_upload_token: () =>
              reply.code(400).send({ error: "invalid_upload_token" }),
            organization_not_found: () =>
              reply.code(404).send({ error: "organization_not_found" }),
            upload_rejected: (value) =>
              reply.code(value.status).send({ error: value.error }),
            index_dispatch_unavailable: (value) =>
              reply.code(503).send({
                error: "knowledge_index_dispatch_unavailable",
                documentId: value.documentId,
              }),
          }),
        ok: (value) => reply.code(201).send(value),
      })
    }
  )

  app.post(
    "/v1/knowledge-documents/text",
    { preHandler, schema: { body: createTextKnowledgeDocumentSchema } },
    async (request, reply) => {
      const auth = organizationAuth(request)
      const result = await createTextKnowledgeDocument({
        organizationId: auth.organization.id,
        createdByUserId: auth.user.id,
        title: request.body.title,
        content: request.body.content,
      })

      return matchResult(result, {
        err: (error) =>
          matchTag(error, {
            organization_not_found: () =>
              reply.code(404).send({ error: "organization_not_found" }),
            index_dispatch_unavailable: (value) =>
              reply.code(503).send({
                error: "knowledge_index_dispatch_unavailable",
                documentId: value.documentId,
              }),
          }),
        ok: (value) => reply.code(201).send(value),
      })
    }
  )

  app.get("/v1/knowledge-documents", { preHandler }, async (request, reply) => {
    const auth = organizationAuth(request)
    const result = await listKnowledgeDocuments({
      organizationId: auth.organization.id,
    })
    return reply.send(result)
  })

  app.get(
    "/v1/knowledge-documents/:documentId",
    { preHandler, schema: { params: knowledgeDocumentParamsSchema } },
    async (request, reply) => {
      const auth = organizationAuth(request)
      const detail = await getKnowledgeDocumentDetail({
        organizationId: auth.organization.id,
        documentId: request.params.documentId,
      })
      if (!detail) {
        return reply.code(404).send({ error: "knowledge_document_not_found" })
      }
      return reply.send(detail)
    }
  )

  app.post(
    "/v1/knowledge-documents/:documentId/reindex",
    { preHandler, schema: { params: knowledgeDocumentParamsSchema } },
    async (request, reply) => {
      const auth = organizationAuth(request)
      const result = await reindexKnowledgeDocument({
        organizationId: auth.organization.id,
        documentId: request.params.documentId,
      })

      return matchResult(result, {
        err: (error) =>
          matchTag(error, {
            not_found: () =>
              reply.code(404).send({ error: "knowledge_document_not_found" }),
            indexing: () =>
              reply.code(409).send({ error: "knowledge_document_indexing" }),
            index_dispatch_unavailable: (value) =>
              reply.code(503).send({
                error: "knowledge_index_dispatch_unavailable",
                documentId: value.documentId,
              }),
          }),
        ok: (value) => reply.send(value),
      })
    }
  )

  app.patch(
    "/v1/knowledge-documents/:documentId",
    {
      preHandler,
      schema: {
        params: knowledgeDocumentParamsSchema,
        body: patchKnowledgeDocumentSchema,
      },
    },
    async (request, reply) => {
      const auth = organizationAuth(request)
      const result = await patchKnowledgeDocument({
        organizationId: auth.organization.id,
        documentId: request.params.documentId,
        title: request.body.title,
        content: request.body.content,
      })

      return matchResult(result, {
        err: (error) =>
          matchTag(error, {
            not_found: () =>
              reply.code(404).send({ error: "knowledge_document_not_found" }),
            not_text: () =>
              reply.code(409).send({ error: "knowledge_document_not_text" }),
            invalid: () => reply.code(400).send({ error: "invalid_request" }),
            index_dispatch_unavailable: (value) =>
              reply.code(503).send({
                error: "knowledge_index_dispatch_unavailable",
                documentId: value.documentId,
              }),
          }),
        ok: (value) => reply.send(value),
      })
    }
  )

  app.put(
    "/v1/knowledge-documents/:documentId/file",
    {
      preHandler,
      schema: {
        params: knowledgeDocumentParamsSchema,
        body: replaceKnowledgeDocumentFileSchema,
      },
    },
    async (request, reply) => {
      const auth = organizationAuth(request)
      const result = await replaceKnowledgeDocumentFile({
        organizationId: auth.organization.id,
        createdByUserId: auth.user.id,
        documentId: request.params.documentId,
        uploadToken: request.body.uploadToken,
        log: request.log,
      })

      return matchResult(result, {
        err: (error) =>
          matchTag(error, {
            invalid_upload_token: () =>
              reply.code(400).send({ error: "invalid_upload_token" }),
            organization_not_found: () =>
              reply.code(404).send({ error: "organization_not_found" }),
            not_found: () =>
              reply.code(404).send({ error: "knowledge_document_not_found" }),
            not_file: () =>
              reply.code(409).send({ error: "knowledge_document_not_file" }),
            upload_rejected: (value) =>
              reply.code(value.status).send({ error: value.error }),
            index_dispatch_unavailable: (value) =>
              reply.code(503).send({
                error: "knowledge_index_dispatch_unavailable",
                documentId: value.documentId,
              }),
          }),
        ok: (value) => reply.send(value),
      })
    }
  )

  app.delete(
    "/v1/knowledge-documents/:documentId",
    { preHandler, schema: { params: knowledgeDocumentParamsSchema } },
    async (request, reply) => {
      const auth = organizationAuth(request)
      const result = await deleteKnowledgeDocument({
        organizationId: auth.organization.id,
        documentId: request.params.documentId,
        log: request.log,
      })

      return matchResult(result, {
        err: (error) =>
          matchTag(error, {
            not_found: () =>
              reply.code(404).send({ error: "knowledge_document_not_found" }),
          }),
        ok: () => reply.code(204).send(),
      })
    }
  )

  app.post(
    "/v1/knowledge-base/preview-response",
    { preHandler, schema: { body: knowledgeTestBodySchema } },
    async (request, reply) => {
      const auth = organizationAuth(request)
      return reply.send(
        await previewKnowledgeResponse({
          organizationId: auth.organization.id,
          question: request.body.question,
        })
      )
    }
  )
}
