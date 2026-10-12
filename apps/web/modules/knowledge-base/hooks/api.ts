import type { KnowledgeDocument, KnowledgeUpload } from "../types"

import { getApiUrl } from "@/lib/env"

const apiUrl = getApiUrl()

export class KnowledgeBaseApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | undefined
  ) {
    super(message)
  }
}

async function request<T>(
  path: string,
  options?: { method?: "POST"; body?: unknown }
): Promise<T> {
  const response = await fetch(new URL(path, apiUrl), {
    method: options?.method,
    credentials: "include",
    headers: {
      accept: "application/json",
      ...(options?.body ? { "content-type": "application/json" } : {}),
    },
    ...(options?.body ? { body: JSON.stringify(options.body) } : {}),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new KnowledgeBaseApiError(
      "knowledge.errors.request",
      response.status,
      typeof body?.error === "string" ? body.error : undefined
    )
  }
  return response.json() as Promise<T>
}

export function listKnowledgeDocuments() {
  return request<{ items: KnowledgeDocument[] }>("/v1/knowledge-documents")
}

export function createTextKnowledgeDocument(input: {
  title: string
  content: string
}) {
  return request<{ document: KnowledgeDocument }>(
    "/v1/knowledge-documents/text",
    {
      method: "POST",
      body: input,
    }
  )
}

export function createKnowledgeUpload(input: {
  fileName: string
  contentType: string
  sizeBytes: number
}) {
  return request<KnowledgeUpload>("/v1/knowledge-document-uploads", {
    method: "POST",
    body: input,
  })
}

export function completeKnowledgeUpload(input: {
  title: string
  uploadToken: string
}) {
  return request<{ document: KnowledgeDocument }>(
    "/v1/knowledge-documents/file",
    {
      method: "POST",
      body: input,
    }
  )
}

export function reindexKnowledgeDocument(documentId: string) {
  return request<{ document: KnowledgeDocument }>(
    `/v1/knowledge-documents/${documentId}/reindex`,
    { method: "POST" }
  )
}

export async function uploadKnowledgeFile(
  file: File,
  upload: KnowledgeUpload
): Promise<Response> {
  return fetch(upload.uploadUrl, {
    method: "PUT",
    headers: upload.headers,
    body: file,
  })
}
