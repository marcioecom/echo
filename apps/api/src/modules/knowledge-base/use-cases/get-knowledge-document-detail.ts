import { knowledgeDocumentsRepository } from "../repositories/knowledge-documents-repository"
import { knowledgeDocumentChunkPageSize } from "../schemas"

export async function getKnowledgeDocumentDetail(input: {
  organizationId: string
  documentId: string
  page: number
}) {
  const document = await knowledgeDocumentsRepository.find(
    input.organizationId,
    input.documentId
  )
  if (!document) return null

  const chunks = await knowledgeDocumentsRepository.listChunks({
    organizationId: input.organizationId,
    documentId: input.documentId,
    page: input.page,
    pageSize: knowledgeDocumentChunkPageSize,
  })

  return {
    document: {
      id: document.id,
      title: document.title,
      sourceType: document.sourceType,
      sourceName: document.sourceName,
      mimeType: document.mimeType,
      sourceSizeBytes: document.sourceSizeBytes,
      content: document.content,
      status: document.status,
      failureReason: document.failureReason,
      revision: document.revision,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
    },
    chunks: {
      items: chunks.items.map((chunk) => ({
        id: chunk.id,
        ordinal: chunk.ordinal,
        content: chunk.content,
        characterCount: chunk.content.length,
      })),
      page: input.page,
      pageSize: knowledgeDocumentChunkPageSize,
      total: chunks.total,
    },
  }
}
