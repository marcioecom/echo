import { knowledgeDocumentsRepository } from "../repositories/knowledge-documents-repository"

export async function getKnowledgeDocumentDetail(input: {
  organizationId: string
  documentId: string
}) {
  const document = await knowledgeDocumentsRepository.find(
    input.organizationId,
    input.documentId
  )
  if (!document) return null

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
  }
}
