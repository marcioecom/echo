import { OpenAIEmbeddings } from "@langchain/openai"
import type { Database } from "@workspace/db"
import {
  knowledgeDocumentChunks,
  knowledgeDocuments,
} from "@workspace/db/schema"
import { and, eq, sql } from "drizzle-orm"

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
  apiKey: string
  embeddingModel: string
}): RetrieveKnowledge {
  const embeddings = new OpenAIEmbeddings({
    apiKey: options.apiKey,
    model: options.embeddingModel,
    configuration: { baseURL: "https://ai-gateway.vercel.sh/v1" },
  })

  return async function retrieveKnowledge(input) {
    const vector = await embeddings.embedQuery(input.query)
    if (vector.length !== 1536) {
      throw new Error("Knowledge query embedding dimension is invalid")
    }
    const queryVector = `[${vector.join(",")}]`
    const similarity = sql<number>`1 - (${knowledgeDocumentChunks.embedding} <=> ${queryVector}::vector)`
    return options.database
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
          eq(knowledgeDocuments.status, "ready")
        )
      )
      .orderBy(sql`${similarity} desc`)
      .limit(input.limit)
  }
}
