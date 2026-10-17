import { OpenAIEmbeddings } from "@langchain/openai"
import {
  createRetrieveKnowledge,
  type RetrieveKnowledge,
} from "@workspace/knowledge"

import { env } from "@/config/env"
import { database } from "@/lib/db"

function buildRetrieveKnowledge(): RetrieveKnowledge | null {
  const apiKey = env.AI_GATEWAY_API_KEY
  if (!apiKey) return null
  const embeddings = new OpenAIEmbeddings({
    apiKey,
    model: env.AI_EMBEDDING_MODEL,
    configuration: { baseURL: "https://ai-gateway.vercel.sh/v1" },
  })
  return createRetrieveKnowledge({
    database: database.db,
    embedQuery: (query) => embeddings.embedQuery(query),
  })
}

export const retrieveKnowledge = buildRetrieveKnowledge()

export function getRetrieveKnowledge(): RetrieveKnowledge | null {
  return retrieveKnowledge
}
