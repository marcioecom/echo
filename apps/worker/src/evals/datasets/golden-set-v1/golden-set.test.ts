import { describe, expect, it } from "vitest"

import { goldenCategories } from "../../types"
import {
  buildGoldenExamples,
  exampleIdForCase,
  goldenBusinesses,
  goldenCases,
} from "./index"

const minimumCases: Record<(typeof goldenCategories)[number], number> = {
  answerable: 8,
  not_in_kb: 4,
  follow_up: 4,
  greeting: 2,
  multi_question: 3,
  angry: 3,
  out_of_scope: 2,
  prompt_injection: 3,
  ambiguous: 2,
  human_requested: 2,
  other_language: 2,
}

describe("golden set v1", () => {
  it("keeps forty cases for the four businesses", () => {
    expect(goldenCases).toHaveLength(40)
    expect(new Set(goldenCases.map((testCase) => testCase.id)).size).toBe(40)
    expect(Object.keys(goldenBusinesses).sort()).toEqual([
      "clinica-luna",
      "loja-linha",
      "padaria-sol",
      "pet-shop-bicho",
    ])
    for (const business of Object.values(goldenBusinesses)) {
      expect(business.chunks.length).toBeGreaterThan(6)
      expect(new Set(business.chunks.map((item) => item.id)).size).toBe(
        business.chunks.length
      )
    }
  })

  it("covers the support situations in the plan", () => {
    const counts = Object.fromEntries(
      goldenCategories.map((category) => [category, 0])
    ) as Record<(typeof goldenCategories)[number], number>
    for (const testCase of goldenCases) counts[testCase.category] += 1
    for (const [category, minimum] of Object.entries(minimumCases)) {
      expect(counts[category as keyof typeof counts]).toBeGreaterThanOrEqual(
        minimum
      )
    }
  })

  it("builds a stable LangSmith example with the current decide context", () => {
    const examples = buildGoldenExamples()
    const ids = examples.map((example) => example.id)
    expect(new Set(ids).size).toBe(examples.length)
    expect(examples[0]?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    )
    expect(exampleIdForCase("padaria-domingo")).toBe(
      examples.find((example) => example.inputs.caseId === "padaria-domingo")
        ?.id
    )

    for (const example of examples) {
      const testCase = goldenCases.find(
        (item) => item.id === example.inputs.caseId
      )
      expect(testCase).toBeDefined()
      expect(example.inputs.history.at(-1)).toBe(
        `contact: ${example.inputs.query}`
      )
      expect(example.inputs.snippets).toHaveLength(6)
      expect(example.inputs.snippets.map((snippet) => snippet.chunkId)).toEqual(
        expect.arrayContaining(testCase?.contextChunkIds ?? [])
      )
      const similarities = example.inputs.snippets.map(
        (snippet) => snippet.similarity
      )
      expect(similarities).toEqual(
        [...similarities].sort((left, right) => right - left)
      )
      for (const chunkId of testCase?.relevantChunkIds ?? []) {
        expect(
          example.inputs.snippets.map((snippet) => snippet.chunkId)
        ).toContain(chunkId)
      }
      expect(example.metadata.goldenSetVersion).toBe("v1")
      expect(example.split).toBe(example.inputs.category)
    }
  })
})
