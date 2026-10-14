import type { BaseChatModel } from "@langchain/core/language_models/chat_models"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../../../config/env", () => ({
  env: {
    AI_GATEWAY_API_KEY: "test-key",
    AI_CHAT_MODEL: "openai/gpt-5.6-luna",
    AI_EMBEDDING_MODEL: "openai/text-embedding-3-small",
  },
}))
vi.mock("../../../lib/db", () => ({
  database: { db: {} },
}))

vi.mock("../../knowledge-base/retrieve-knowledge", () => ({
  retrieveKnowledge: vi.fn(),
}))

import { retrieveKnowledge } from "../../knowledge-base/retrieve-knowledge"
import { createSupportAgentGraph } from "./support-agent-graph"

const snippet = {
  chunkId: "01CHUNK000000000000000000",
  documentId: "01DOC00000000000000000000",
  documentTitle: "Horário",
  content: "Abrimos domingo das 9h às 13h.",
  similarity: 0.82,
}

describe("createSupportAgentGraph", () => {
  beforeEach(() => {
    vi.stubEnv("LANGSMITH_TRACING", "false")
    delete process.env.LANGSMITH_API_KEY
  })

  it("retrieves knowledge before asking the model to decide", async () => {
    vi.mocked(retrieveKnowledge).mockResolvedValue([snippet])
    const invoke = vi.fn<
      (
        messages: Array<[string, string]>
      ) => Promise<{ action: "reply"; replyType: "answer"; body: string }>
    >(async () => ({
      action: "reply",
      replyType: "answer",
      body: "Abrimos domingo das 9h às 13h.",
    }))
    const model = {
      withStructuredOutput: vi.fn(() => ({ invoke })),
    }
    const graph = createSupportAgentGraph(
      model as unknown as Pick<BaseChatModel, "withStructuredOutput">
    )

    const result = await graph.invoke({
      organizationId: "01ORGANIZATION000000000000",
      query: "vocês abrem domingo?",
      history: ["contact: vocês abrem domingo?"],
    })

    expect(retrieveKnowledge).toHaveBeenCalledWith({
      organizationId: "01ORGANIZATION000000000000",
      query: "vocês abrem domingo?",
      limit: 6,
    })
    expect(vi.mocked(retrieveKnowledge).mock.invocationCallOrder[0]).toBeLessThan(
      invoke.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY
    )
    const messages = invoke.mock.calls[0]?.[0]
    expect(JSON.parse(messages?.[1]?.[1] ?? "{}")).toMatchObject({
      query: "vocês abrem domingo?",
      snippets: [snippet],
    })
    expect(result.decision).toEqual({
      action: "reply",
      replyType: "answer",
      body: "Abrimos domingo das 9h às 13h.",
    })
  })
})
