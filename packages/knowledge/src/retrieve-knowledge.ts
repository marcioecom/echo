import type { Database } from "@workspace/db"
import {
  knowledgeDocumentChunks,
  knowledgeDocuments,
} from "@workspace/db/schema"
import { and, eq, sql } from "drizzle-orm"

import { activeKnowledgeDocument } from "./active-document"

export const supportAgentRetrievedChunkLimit = 6

export interface KnowledgeSnippet {
  chunkId: string
  documentId: string
  documentTitle: string
  content: string
  similarity: number
}

export type RetrieveKnowledge = (input: {
  organizationId: string
  query: string
  limit: number
}) => Promise<KnowledgeSnippet[]>

export function createRetrieveKnowledge(options: {
  database: Database
  embedQuery: (query: string) => Promise<number[]>
}): RetrieveKnowledge {
  return async function retrieveKnowledge(input) {
    const vector = await options.embedQuery(input.query)
    if (
      vector.length !== 1536 ||
      vector.some((value) => !Number.isFinite(value))
    ) {
      throw new Error("Knowledge query embedding dimension is invalid")
    }
    const queryVector = `[${vector.join(",")}]`
    const similarity = sql<number>`1 - (${knowledgeDocumentChunks.embedding} <=> ${queryVector}::vector)`
    const rows = await options.database
      .select({
        chunkId: knowledgeDocumentChunks.id,
        documentId: knowledgeDocuments.id,
        documentTitle: knowledgeDocuments.title,
        content: knowledgeDocumentChunks.content,
        similarity,
      })
      .from(knowledgeDocumentChunks)
      .innerJoin(
        knowledgeDocuments,
        and(
          eq(
            knowledgeDocuments.organizationId,
            knowledgeDocumentChunks.organizationId
          ),
          eq(knowledgeDocuments.id, knowledgeDocumentChunks.knowledgeDocumentId)
        )
      )
      .where(
        and(
          eq(knowledgeDocumentChunks.organizationId, input.organizationId),
          activeKnowledgeDocument(input.organizationId)
        )
      )
      .orderBy(sql`${similarity} desc`)
      .limit(input.limit)

    return rows.map((row) => ({
      ...row,
      similarity: Number(row.similarity),
    }))
  }
}

export interface KnowledgeTestHit {
  documentId: string
  title: string
  excerpt: string
  score: number
}

export interface KnowledgeTestResult {
  threshold: number | null
  hits: readonly KnowledgeTestHit[]
}

export async function testKnowledgeQuery(
  retrieve: RetrieveKnowledge,
  input: { organizationId: string; question: string }
): Promise<KnowledgeTestResult> {
  const snippets = await retrieve({
    organizationId: input.organizationId,
    query: input.question,
    limit: supportAgentRetrievedChunkLimit,
  })
  return {
    threshold: null,
    hits: snippets.map((snippet) => ({
      documentId: snippet.documentId,
      title: snippet.documentTitle,
      excerpt: snippet.content,
      score: snippet.similarity,
    })),
  }
}
