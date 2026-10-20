import { OpenAIEmbeddings } from "@langchain/openai"
import type { Database } from "@workspace/db"
import { createRetrieveKnowledge } from "@workspace/knowledge"

import {
  createSupportAgentGraph,
  createSupportAgentModel,
  createUnsupportedHandoffDraft,
} from "./support-agent-graph"
export {
  createSupportAgentGraph,
  createSupportAgentModel,
} from "./support-agent-graph"

export function createSupportAgent(options: {
  database: Database
  apiKey: string
  chatModel: string
  embeddingModel: string
}) {
  const model = createSupportAgentModel({
    apiKey: options.apiKey,
    modelName: options.chatModel,
  })
  const embeddings = new OpenAIEmbeddings({
    apiKey: options.apiKey,
    model: options.embeddingModel,
    configuration: { baseURL: "https://ai-gateway.vercel.sh/v1" },
  })
  const retrieve = createRetrieveKnowledge({
    database: options.database,
    embedQuery: (query) => embeddings.embedQuery(query),
  })
  return {
    graph: createSupportAgentGraph(model, retrieve),
    draftUnsupportedHandoffCopy: createUnsupportedHandoffDraft(model),
  }
}
