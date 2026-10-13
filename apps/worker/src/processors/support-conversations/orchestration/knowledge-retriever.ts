import { Document, type DocumentInterface } from "@langchain/core/documents"
import { BaseRetriever } from "@langchain/core/retrievers"

import type { KnowledgeSnippet } from "../../knowledge-base/retrieve-knowledge"

type RetrieveKnowledge = (input: {
  organizationId: string
  query: string
  limit: number
}) => Promise<KnowledgeSnippet[]>

export class KnowledgeBaseRetriever extends BaseRetriever {
  lc_namespace = ["echo", "retrievers"]

  private readonly retrieveKnowledge: RetrieveKnowledge
  private readonly organizationId: string
  private readonly limit: number

  constructor(fields: {
    retrieveKnowledge: RetrieveKnowledge
    organizationId: string
    limit: number
  }) {
    super()
    this.retrieveKnowledge = fields.retrieveKnowledge
    this.organizationId = fields.organizationId
    this.limit = fields.limit
  }

  async _getRelevantDocuments(query: string): Promise<DocumentInterface[]> {
    const snippets = await this.retrieveKnowledge({
      organizationId: this.organizationId,
      query,
      limit: this.limit,
    })

    return snippets.map(
      (snippet) =>
        new Document({
          id: snippet.chunkId,
          pageContent: snippet.content,
          metadata: {
            chunkId: snippet.chunkId,
            documentId: snippet.documentId,
            documentTitle: snippet.documentTitle,
            similarity: snippet.similarity,
          },
        })
    )
  }
}

export function snippetsFromDocuments(
  documents: ReadonlyArray<DocumentInterface>
): KnowledgeSnippet[] {
  return documents.map((document) => ({
    chunkId: String(document.metadata.chunkId),
    documentId: String(document.metadata.documentId),
    documentTitle: String(document.metadata.documentTitle),
    content: document.pageContent,
    similarity: Number(document.metadata.similarity),
  }))
}
