import type { BaseChatModel } from "@langchain/core/language_models/chat_models"
import { StateGraph, StateSchema } from "@langchain/langgraph"
import { ChatOpenAI } from "@langchain/openai"
import { z } from "zod"

import { env } from "../../../config/env"
import {
  retrieveKnowledge,
  type KnowledgeSnippet,
} from "../../knowledge-base/retrieve-knowledge"

export const supportAgentRetrievedChunkLimit = 6

export const supportAgentSystemPrompt =
  "You are Echo, the first support contact. Answer only from tenant knowledge and conversation history. Use the contact language. Never invent policy or actions. Hand off for a requested human, insufficient evidence, or unsupported policy. Ask a concise clarification only when one missing fact can unlock a grounded answer."

export function buildSupportAgentMessages(input: {
  history: string[]
  snippets: KnowledgeSnippet[]
  query: string
}): Array<["system" | "human", string]> {
  return [
    ["system", supportAgentSystemPrompt],
    [
      "human",
      JSON.stringify({
        history: input.history,
        snippets: input.snippets,
        query: input.query,
      }),
    ],
  ]
}

export const agentDecisionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("reply"),
    replyType: z.enum(["answer", "clarification"]),
    body: z.string().trim().min(1).max(1600),
  }),
  z.object({
    action: z.literal("handoff"),
    reason: z.enum(["human_requested", "low_confidence", "unsupported_policy"]),
  }),
])
export type AgentDecision = z.infer<typeof agentDecisionSchema>

const knowledgeSnippetSchema = z.object({
  chunkId: z.string(),
  documentId: z.string(),
  documentTitle: z.string(),
  content: z.string(),
  similarity: z.number(),
})

const graphState = new StateSchema({
  organizationId: z.string(),
  query: z.string(),
  history: z.array(z.string()),
  snippets: z.array(knowledgeSnippetSchema).optional(),
  decision: agentDecisionSchema.optional(),
})

export function createSupportAgentGraph(
  model: Pick<BaseChatModel, "withStructuredOutput">,
  retrieve: typeof retrieveKnowledge = retrieveKnowledge
) {
  return new StateGraph({ stateSchema: graphState })
    .addNode("retrieve", async (state) => ({
      snippets: await retrieve({
        organizationId: state.organizationId,
        query: state.query,
        limit: supportAgentRetrievedChunkLimit,
      }),
    }))
    .addNode("decide", async (state) => {
      const decision = await model
        .withStructuredOutput(agentDecisionSchema)
        .invoke(
          buildSupportAgentMessages({
            history: state.history,
            snippets: state.snippets ?? [],
            query: state.query,
          })
        )
      return { decision }
    })
    .addEdge("__start__", "retrieve")
    .addEdge("retrieve", "decide")
    .addEdge("decide", "__end__")
    .compile()
}

export function createSupportAgentModel() {
  return new ChatOpenAI({
    apiKey: env.AI_GATEWAY_API_KEY,
    modelName: env.AI_CHAT_MODEL,
    configuration: { baseURL: "https://ai-gateway.vercel.sh/v1" },
  })
}

export const supportAgentGraph = createSupportAgentGraph(
  createSupportAgentModel()
)
