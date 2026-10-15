import { z } from "zod"

export const goldenSetVersion = "v1"
export const goldenDatasetName = "echo-support-agent-golden-v1"
export const goldenDatasetTag = "v1"

export const handoffReasons = [
  "human_requested",
  "low_confidence",
  "unsupported_policy",
] as const

export const goldenCategories = [
  "answerable",
  "not_in_kb",
  "follow_up",
  "greeting",
  "multi_question",
  "angry",
  "out_of_scope",
  "prompt_injection",
  "ambiguous",
  "human_requested",
  "other_language",
] as const

export const businessIds = [
  "padaria-sol",
  "clinica-luna",
  "pet-shop-bicho",
  "loja-linha",
] as const

export type HandoffReason = (typeof handoffReasons)[number]
export type GoldenCategory = (typeof goldenCategories)[number]
export type BusinessId = (typeof businessIds)[number]

export type KnowledgeChunk = {
  id: string
  documentId: string
  documentTitle: string
  content: string
}

export type GoldenBusiness = {
  id: BusinessId
  name: string
  organizationId: string
  chunks: KnowledgeChunk[]
}

const replyTypeSchema = z.enum(["answer", "clarification"])
const handoffReasonSchema = z.enum(handoffReasons)

export const referenceDecisionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("reply"),
    replyType: replyTypeSchema,
  }),
  z.object({
    kind: z.literal("handoff"),
    reasons: z.array(handoffReasonSchema),
  }),
  z.object({
    kind: z.literal("abstain"),
    reasons: z.array(handoffReasonSchema),
  }),
])

export type ReferenceDecision = z.infer<typeof referenceDecisionSchema>

export type GoldenCase = {
  id: string
  businessId: BusinessId
  category: GoldenCategory
  query: string
  history: string[]
  contextChunkIds: string[]
  relevantChunkIds: string[]
  decision: ReferenceDecision
  reference: string
  mustNotClaim: string[]
}

export const retrievedSnippetSchema = z.object({
  chunkId: z.string(),
  documentId: z.string(),
  documentTitle: z.string(),
  content: z.string(),
  similarity: z.number(),
})

export const goldenInputsSchema = z.object({
  caseId: z.string(),
  businessId: z.enum(businessIds),
  businessName: z.string(),
  organizationId: z.string(),
  category: z.enum(goldenCategories),
  query: z.string().min(1),
  history: z.array(z.string()).min(1),
  snippets: z.array(retrievedSnippetSchema).min(1).max(6),
})

export const goldenReferenceSchema = z.object({
  decision: referenceDecisionSchema,
  reference: z.string().min(1),
  mustNotClaim: z.array(z.string()),
})

export const goldenOutputsSchema = z.object({
  action: z.enum(["reply", "handoff"]),
  replyType: replyTypeSchema.nullable(),
  reason: handoffReasonSchema.nullable(),
  body: z.string().nullable(),
  customerMessage: z.string().nullable(),
  summary: z.string().nullable(),
})

export type GoldenInputs = z.infer<typeof goldenInputsSchema>
export type GoldenReference = z.infer<typeof goldenReferenceSchema>
export type GoldenOutputs = z.infer<typeof goldenOutputsSchema>
