import type { KnowledgeDocumentRecord } from "@workspace/knowledge"

export type DocumentDtoInput = Pick<
  KnowledgeDocumentRecord,
  | "id"
  | "title"
  | "sourceType"
  | "sourceName"
  | "mimeType"
  | "sourceSizeBytes"
  | "status"
  | "failureReason"
  | "revision"
  | "createdAt"
  | "updatedAt"
>

export function documentDto(document: DocumentDtoInput) {
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

export type DocumentDto = ReturnType<typeof documentDto>
