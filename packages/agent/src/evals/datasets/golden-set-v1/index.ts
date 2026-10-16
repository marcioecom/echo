import { createHash } from "node:crypto"

import { buildRetrievedSnippets } from "../../snippets"
import {
  goldenInputsSchema,
  goldenReferenceSchema,
  goldenSetVersion,
  type GoldenInputs,
  type GoldenReference,
} from "../../types"
import { goldenBusinesses } from "./businesses"
import { goldenCases } from "./cases"

export { goldenBusinesses } from "./businesses"
export { goldenCases } from "./cases"

export type GoldenExample = {
  id: string
  inputs: GoldenInputs
  outputs: GoldenReference
  metadata: {
    caseId: string
    category: string
    businessId: string
    goldenSetVersion: typeof goldenSetVersion
    relevantChunkIds: string[]
  }
  split: string
}

export function exampleIdForCase(caseId: string): string {
  const bytes = createHash("sha256")
    .update(`echo-golden-${goldenSetVersion}:${caseId}`)
    .digest()
    .subarray(0, 16)
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
  const hex = Buffer.from(bytes).toString("hex")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function buildGoldenExamples(): GoldenExample[] {
  return goldenCases.map((testCase) => {
    const business = goldenBusinesses[testCase.businessId]
    const snippets = buildRetrievedSnippets(
      business.chunks,
      testCase.contextChunkIds
    )
    const inputs = goldenInputsSchema.parse({
      caseId: testCase.id,
      businessId: business.id,
      businessName: business.name,
      organizationId: business.organizationId,
      category: testCase.category,
      query: testCase.query,
      history: testCase.history,
      snippets,
    })
    const outputs = goldenReferenceSchema.parse({
      decision: testCase.decision,
      reference: testCase.reference,
      mustNotClaim: testCase.mustNotClaim,
    })
    return {
      id: exampleIdForCase(testCase.id),
      inputs,
      outputs,
      metadata: {
        caseId: testCase.id,
        category: testCase.category,
        businessId: business.id,
        goldenSetVersion,
        relevantChunkIds: testCase.relevantChunkIds,
      },
      split: testCase.category,
    }
  })
}
