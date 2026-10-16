import type { BaseChatModel } from "@langchain/core/language_models/chat_models"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  agentDecisionSchema,
  createSupportAgentGraph,
  createUnsupportedHandoffDraft,
  supportAgentInstructions,
} from "./support-agent-graph"

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
    const retrieve = vi.fn().mockResolvedValue([snippet])
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
      model as unknown as Pick<BaseChatModel, "withStructuredOutput">,
      retrieve
    )

    const result = await graph.invoke({
      organizationId: "01ORGANIZATION000000000000",
      query: "vocês abrem domingo?",
      history: ["contact: vocês abrem domingo?"],
    })

    expect(retrieve).toHaveBeenCalledWith({
      organizationId: "01ORGANIZATION000000000000",
      query: "vocês abrem domingo?",
      limit: 6,
    })
    expect(retrieve.mock.invocationCallOrder[0]).toBeLessThan(
      invoke.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY
    )
    const messages = invoke.mock.calls[0]?.[0]
    expect(messages?.[0]?.[1]).toBe(supportAgentInstructions)
    expect(supportAgentInstructions).toContain("customerMessage")
    expect(supportAgentInstructions).toContain("Do not promise a wait time")
    expect(supportAgentInstructions).toContain("what the customer wants")
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

  it("uses an injected retriever when the eval supplies one", async () => {
    const retrieve = vi.fn().mockResolvedValue([snippet])
    const invoke = vi.fn(async () => ({
      action: "reply" as const,
      replyType: "answer" as const,
      body: "Abrimos domingo das 9h às 13h.",
    }))
    const model = {
      withStructuredOutput: vi.fn(() => ({ invoke })),
    }
    const graph = createSupportAgentGraph(
      model as unknown as Pick<BaseChatModel, "withStructuredOutput">,
      retrieve
    )

    await graph.invoke({
      organizationId: "01ORGANIZATION000000000000",
      query: "vocês abrem domingo?",
      history: ["contact: vocês abrem domingo?"],
    })

    expect(retrieve).toHaveBeenCalledWith({
      organizationId: "01ORGANIZATION000000000000",
      query: "vocês abrem domingo?",
      limit: 6,
    })
  })

  it("requires a customer message and an operator summary on handoff", () => {
    expect(
      agentDecisionSchema.safeParse({
        action: "handoff",
        reason: "low_confidence",
      }).success
    ).toBe(false)
    expect(
      agentDecisionSchema.safeParse({
        action: "handoff",
        reason: "low_confidence",
        customerMessage:
          "Vou chamar alguém da equipe pra continuar com você, tá?",
        summary: "Quer o horário de domingo. A base não cobre. Tom neutro.",
      }).success
    ).toBe(true)
  })

  it("asks for handoff copy in the contact language without a promised time", async () => {
    const invoke = vi.fn<
      (
        messages: Array<[string, string]>
      ) => Promise<{ customerMessage: string; summary: string }>
    >(async () => ({
      customerMessage: "I'll ask someone from the team to continue with you.",
      summary: "Wants Sunday hours. Knowledge has no hours. Calm.",
    }))
    const model = {
      withStructuredOutput: vi.fn(() => ({ invoke })),
    }
    const draft = createUnsupportedHandoffDraft(
      model as unknown as Pick<BaseChatModel, "withStructuredOutput">
    )

    const copy = await draft({
      history: ["contact: can someone call me?"],
      mediaKind: "audio",
    })

    const messages = invoke.mock.calls[0]?.[0]
    expect(messages?.[0]?.[1]).toContain("Do not promise a wait time")
    expect(messages?.[0]?.[1]).toContain(
      "Portuguese when the history has no text"
    )
    expect(JSON.parse(messages?.[1]?.[1] ?? "{}")).toEqual({
      history: ["contact: can someone call me?"],
      mediaKind: "audio",
    })
    expect(copy.customerMessage).toContain("someone from the team")
  })
})
