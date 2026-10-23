import { z } from "zod"

export const redirectSearchSchema = z.object({
  redirect: z.string().optional(),
  email: z.string().optional(),
  source: z.string().optional(),
})

export const resetPasswordSearchSchema = z.object({
  token: z.string().optional(),
})
