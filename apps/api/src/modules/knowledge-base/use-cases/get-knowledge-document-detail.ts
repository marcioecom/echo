import { getKnowledgeDocument } from "@workspace/knowledge"

import { database } from "@/lib/db"

export async function getKnowledgeDocumentDetail(input: {
  organizationId: string
  documentId: string
}) {
  const detail = await getKnowledgeDocument(database.db, input)
  if (!detail) return null
  const document = detail.document

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
    previousVersionActive: detail.previousVersionActive,
  }
}
