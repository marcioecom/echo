import {
  createSupportAgentGraph,
  createSupportAgentModel,
  type AgentDecision,
} from "../processors/support-conversations/orchestration/support-agent-graph"
import {
  goldenInputsSchema,
  goldenSetVersion,
  type GoldenOutputs,
} from "./types"

type SupportModel = ReturnType<typeof createSupportAgentModel>

function toOutputs(decision: AgentDecision): GoldenOutputs {
  if (decision.action === "reply") {
    return {
      action: "reply",
      replyType: decision.replyType,
      reason: null,
      body: decision.body,
    }
  }
  return {
    action: "handoff",
    replyType: null,
    reason: decision.reason,
    body: null,
  }
}

export function createDecideTarget(model: SupportModel) {
  return async function runSupportAgentDecide(
    rawInputs: Record<string, unknown>
  ) {
    const inputs = goldenInputsSchema.parse(rawInputs)
    const graph = createSupportAgentGraph(model, async () => inputs.snippets)
    const result = await graph.invoke(
      {
        organizationId: inputs.organizationId,
        query: inputs.query,
        history: inputs.history,
      },
      {
        runName: "support-agent",
        tags: ["support-agent", "eval", "golden-v1", inputs.category],
        metadata: {
          organizationId: inputs.organizationId,
          caseId: inputs.caseId,
          category: inputs.category,
          businessId: inputs.businessId,
          goldenSetVersion,
          model: process.env.AI_CHAT_MODEL ?? "openai/gpt-5.6-luna",
        },
      }
    )
    if (!result.decision) {
      throw new Error(`Agente não decidiu no caso ${inputs.caseId}`)
    }
    return toOutputs(result.decision)
  }
}
