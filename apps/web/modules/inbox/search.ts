import { z } from "zod"

export const inboxStatusValues = [
  "all",
  "open",
  "ai_active",
  "human_required",
  "resolved",
] as const

export const inboxSearchSchema = z.object({
  status: z.enum(inboxStatusValues).catch("all").default("all"),
})
