import { describe, expect, it } from "vitest"

import { scoreHandoffDecision } from "./handoff-decision"
import { formatEvalReport, meanScore, percentile } from "./report"
import { buildRetrievedSnippets } from "./snippets"
import type { GoldenOutputs } from "./types"

const chunks = [
  { id: "a", documentId: "doc-a", documentTitle: "A", content: "primeiro" },
  { id: "b", documentId: "doc-b", documentTitle: "B", content: "segundo" },
  { id: "c", documentId: "doc-c", documentTitle: "C", content: "terceiro" },
  { id: "d", documentId: "doc-d", documentTitle: "D", content: "quarto" },
  { id: "e", documentId: "doc-e", documentTitle: "E", content: "quinto" },
  { id: "f", documentId: "doc-f", documentTitle: "F", content: "sexto" },
  { id: "g", documentId: "doc-g", documentTitle: "G", content: "sétimo" },
]

const reply: GoldenOutputs = {
  action: "reply",
  replyType: "answer",
  reason: null,
  body: "Abrimos domingo das 7h às 13h.",
  customerMessage: null,
  summary: null,
}

const handoff: GoldenOutputs = {
  action: "handoff",
  replyType: null,
  reason: "human_requested",
  body: null,
  customerMessage: "Vou pedir para alguém do time continuar com você.",
  summary: "Cliente pediu atendente humano. Tom neutro.",
}

describe("retrieved snippets", () => {
  it("puts the case context first and fills the remaining slots", () => {
    const snippets = buildRetrievedSnippets(chunks, ["c", "a"])
    expect(snippets.map((snippet) => snippet.chunkId)).toEqual([
      "c",
      "a",
      "b",
      "d",
      "e",
      "f",
    ])
    expect(snippets.map((snippet) => snippet.similarity)).toEqual([
      0.9, 0.85, 0.8, 0.75, 0.7, 0.65,
    ])
  })

  it("rejects an unknown chunk", () => {
    expect(() => buildRetrievedSnippets(chunks, ["missing"])).toThrow(
      /desconhecido/
    )
  })
})

describe("handoff decision", () => {
  it("scores an exact reply", () => {
    expect(
      scoreHandoffDecision(reply, { kind: "reply", replyType: "answer" }).score
    ).toBe(1)
    expect(
      scoreHandoffDecision(reply, { kind: "reply", replyType: "clarification" })
        .score
    ).toBe(0)
  })

  it("scores the handoff reason when the reference names one", () => {
    expect(
      scoreHandoffDecision(handoff, {
        kind: "handoff",
        reasons: ["human_requested"],
      }).score
    ).toBe(1)
    expect(
      scoreHandoffDecision(
        { ...handoff, reason: "low_confidence" },
        { kind: "handoff", reasons: ["human_requested"] }
      ).score
    ).toBe(0)
  })

  it("accepts a reply or a handoff when the case should abstain", () => {
    expect(
      scoreHandoffDecision(reply, { kind: "abstain", reasons: [] }).score
    ).toBe(1)
    expect(
      scoreHandoffDecision(handoff, { kind: "abstain", reasons: [] }).score
    ).toBe(1)
    expect(
      scoreHandoffDecision(reply, { kind: "handoff", reasons: [] }).score
    ).toBe(0)
  })
})

describe("eval report", () => {
  it("averages scores and counts unsupported claims outside the KB", () => {
    const report = formatEvalReport([
      {
        category: "answerable",
        scores: {
          correctness: 1,
          groundedness: 1,
          handoff_decision: 1,
          tone: 0.5,
        },
      },
      {
        category: "not_in_kb",
        scores: {
          correctness: 0,
          groundedness: 0,
          handoff_decision: 1,
          tone: null,
        },
      },
      {
        category: "prompt_injection",
        scores: {
          correctness: 1,
          groundedness: 1,
          handoff_decision: 1,
          tone: 1,
        },
      },
    ])
    expect(report).toContain("correctness        0.67")
    expect(report).toContain("tone               0.75")
    expect(report).toContain("alucinacao_fora_kb 1/2")
    expect(meanScore([1, null, 0])).toBe(0.5)
    expect(percentile([10, 30, 20, 40], 0.5)).toBe(20)
    expect(percentile([10, 30, 20, 40], 0.95)).toBe(40)
  })
})
