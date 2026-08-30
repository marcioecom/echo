export type KnowledgeDocumentStatus = "pending" | "processing" | "ready" | "failed"
export type KnowledgeDocumentFailureReason =
  | "index_dispatch_failed"
  | "indexing_failed"
  | null

export interface KnowledgeDocument {
  id: string
  title: string
  sourceType: "text" | "file"
  sourceName: string | null
  mimeType: string | null
  sourceSizeBytes: number | null
  status: KnowledgeDocumentStatus
  failureReason: KnowledgeDocumentFailureReason
  revision: number
  createdAt: string
  updatedAt: string
}

export interface KnowledgeUpload {
  uploadUrl: string
  uploadToken: string
  expiresAt: string
  headers: { "Content-Type": string }
}
