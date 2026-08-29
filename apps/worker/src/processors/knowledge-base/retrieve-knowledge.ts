import { OpenAIEmbeddings } from "@langchain/openai"
import { knowledgeDocumentChunks, knowledgeDocuments } from "@workspace/db/schema"
import { and, eq, sql } from "drizzle-orm"

import { env } from "../../config/env"
import { database } from "../../lib/db"

export interface KnowledgeSnippet {
  chunkId: string
  documentId: string
  documentTitle: string
  content: string
  similarity: number
}

const embeddings = new OpenAIEmbeddings({
  apiKey: env.AI_GATEWAY_API_KEY,
  model: env.AI_EMBEDDING_MODEL,
  configuration: { baseURL: "https://ai-gateway.vercel.sh/v1" },
})

export async function retrieveKnowledge(input: {
  organizationId: string
  query: string
  limit: number
}): Promise<KnowledgeSnippet[]> {
  const vector = await embeddings.embedQuery(input.query)
  if (vector.length !== 1536) throw new Error("Knowledge query embedding dimension is invalid")
  const queryVector = `[${vector.join(",")}]`
  const similarity = sql<number>`1 - (${knowledgeDocumentChunks.embedding} <=> ${queryVector}::vector)`
  return database.db
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
        eq(knowledgeDocuments.organizationId, knowledgeDocumentChunks.organizationId),
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
