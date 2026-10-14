import { z } from "zod"

export const inboxStatusValues = [
  "all",
  "open",
  "ai_active",
  "human_required",
  "resolved",
] as const

export const inboxSearchSchema = z.object({
  // Default to the operator's job: conversations that need a person.
  status: z
    .enum(inboxStatusValues)
    .catch("human_required")
    .default("human_required"),
})
