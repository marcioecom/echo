import { ChatOpenAI } from "@langchain/openai"
import { StateGraph, StateSchema } from "@langchain/langgraph"
import { z } from "zod"

import { env } from "../../../config/env"
import type { KnowledgeSnippet } from "../../knowledge-base/retrieve-knowledge"
import { retrieveKnowledge } from "../../knowledge-base/retrieve-knowledge"

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

const graphState = new StateSchema({
  organizationId: z.string(),
  query: z.string(),
  history: z.array(z.string()),
  decision: agentDecisionSchema.optional(),
})

export function createSupportAgentGraph(input: {
  retrieveKnowledge: (input: { organizationId: string; query: string; limit: number }) => Promise<KnowledgeSnippet[]>
  model: Pick<ChatOpenAI, "withStructuredOutput">
}) {
  return new StateGraph({ stateSchema: graphState })
    .addNode("decide", async (state) => {
      const snippets = await input.retrieveKnowledge({
        organizationId: state.organizationId,
        query: state.query,
        limit: 6,
      })
      const decision = await input.model.withStructuredOutput(agentDecisionSchema).invoke([
        ["system", "You are Echo, the first support contact. Answer only from tenant knowledge and conversation history. Use the contact language. Never invent policy or actions. Hand off for a requested human, insufficient evidence, or unsupported policy. Ask a concise clarification only when one missing fact can unlock a grounded answer."],
        ["human", JSON.stringify({ history: state.history, snippets, query: state.query })],
      ])
      return { decision }
    })
    .addEdge("__start__", "decide")
    .addEdge("decide", "__end__")
    .compile()
}

const model = new ChatOpenAI({
  apiKey: env.AI_GATEWAY_API_KEY,
  modelName: env.AI_CHAT_MODEL,
  configuration: { baseURL: "https://ai-gateway.vercel.sh/v1" },
})

export const supportAgentGraph = createSupportAgentGraph({ retrieveKnowledge, model })
