import { describe, expect, it, vi } from "vitest"

import {
  supportAgentRetrievedChunkLimit,
  testKnowledgeQuery,
  type RetrieveKnowledge,
} from "./retrieve-knowledge"

describe("testKnowledgeQuery", () => {
  it("returns the support limit with scores and no pass mark", async () => {
    const retrieve = vi.fn<RetrieveKnowledge>(async (input) => {
      expect(input).toEqual({
        organizationId: "01K1EDN69NFBWCG42B2H99V2C4",
        query: "Que horas a padaria abre?",
        limit: supportAgentRetrievedChunkLimit,
      })
      return [
        {
          chunkId: "01K1CHUNK00000000000000001",
          documentId: "01K1EDN69NFBWCG42B2H99V2C4",
          documentTitle: "Horário da padaria",
          content: "Abrimos de terça a sábado.",
          similarity: 0.84,
        },
      ]
    })

    const result = await testKnowledgeQuery(retrieve, {
      organizationId: "01K1EDN69NFBWCG42B2H99V2C4",
      question: "Que horas a padaria abre?",
    })

    expect(result).toEqual({
      threshold: null,
      hits: [
        {
          documentId: "01K1EDN69NFBWCG42B2H99V2C4",
          title: "Horário da padaria",
          excerpt: "Abrimos de terça a sábado.",
          score: 0.84,
        },
      ],
    })
    expect(result.hits[0]).not.toHaveProperty("passesThreshold")
    expect(supportAgentRetrievedChunkLimit).toBe(6)
  })
})
