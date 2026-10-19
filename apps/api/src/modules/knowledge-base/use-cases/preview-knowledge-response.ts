import { OpenAIEmbeddings } from "@langchain/openai"
import {
  createSupportAgentGraph,
  createSupportAgentModel,
} from "@workspace/agent"
import { createRetrieveKnowledge } from "@workspace/knowledge"

import { env } from "@/config/env"
import { database } from "@/lib/db"

const embeddings = new OpenAIEmbeddings({
  apiKey: env.AI_GATEWAY_API_KEY,
  model: env.AI_EMBEDDING_MODEL,
  configuration: { baseURL: "https://ai-gateway.vercel.sh/v1" },
})

const retrieve = createRetrieveKnowledge({
  database: database.db,
  embedQuery: (query) => embeddings.embedQuery(query),
})

const model = createSupportAgentModel({
  apiKey: env.AI_GATEWAY_API_KEY,
  modelName: env.AI_CHAT_MODEL,
})
const previewGraph = createSupportAgentGraph(model, retrieve)

export async function previewKnowledgeResponse(input: {
  organizationId: string
  question: string
}) {
  const result = await previewGraph.invoke({
    organizationId: input.organizationId,
    query: input.question,
    history: [],
  })
  const decision = result.decision
  if (!decision) throw new Error("Support agent returned no decision")

  return {
    decision,
    hits: (result.snippets ?? []).map((snippet) => ({
      documentId: snippet.documentId,
      title: snippet.documentTitle,
      excerpt: snippet.content,
      score: snippet.similarity,
    })),
  }
}
