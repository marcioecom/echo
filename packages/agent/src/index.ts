import type { Database } from "@workspace/db"

import { createRetrieveKnowledge } from "./retrieve-knowledge"
import {
  createSupportAgentGraph,
  createSupportAgentModel,
  createUnsupportedHandoffDraft,
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
  const retrieve = createRetrieveKnowledge({
    database: options.database,
    apiKey: options.apiKey,
    embeddingModel: options.embeddingModel,
  })
  return {
    graph: createSupportAgentGraph(model, retrieve),
    draftUnsupportedHandoffCopy: createUnsupportedHandoffDraft(model),
  }
}
