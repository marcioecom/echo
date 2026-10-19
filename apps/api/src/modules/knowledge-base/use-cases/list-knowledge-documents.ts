import { listKnowledgeDocuments as listKnowledgeDocumentRecords } from "@workspace/knowledge"

import { database } from "@/lib/db"

import { type DocumentDto, documentDto } from "./document-dto"

export async function listKnowledgeDocuments(input: {
  organizationId: string
}): Promise<{ items: DocumentDto[] }> {
  const documents = await listKnowledgeDocumentRecords(
    database.db,
    input.organizationId
  )
  return { items: documents.map(documentDto) }
}
