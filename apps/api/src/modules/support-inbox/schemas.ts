import { supportConversationStatusSchema, ulidSchema } from "@workspace/domain"
import { z } from "zod"

import type { SupportInboxCursor } from "./types"

const pageSize = 10

export const listSupportConversationsQuerySchema = z.object({
  status: supportConversationStatusSchema.optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(pageSize).default(pageSize),
})

export const supportConversationParamsSchema = z.object({
  conversationId: ulidSchema,
})

export const createOperatorReplyBodySchema = z.object({
  body: z.string().trim().min(1).max(1600),
})

export function encodeSupportInboxCursor(input: SupportInboxCursor): string {
  return Buffer.from(
    JSON.stringify({
      lastActivityAt: input.lastActivityAt.toISOString(),
      id: input.id,
    })
  ).toString("base64url")
}

export function decodeSupportInboxCursor(value: string): SupportInboxCursor | null {
  try {
    const parsed = z
      .object({ lastActivityAt: z.iso.datetime(), id: ulidSchema })
      .safeParse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")))
    if (!parsed.success) return null

    return {
      lastActivityAt: new Date(parsed.data.lastActivityAt),
      id: parsed.data.id,
    }
  } catch {
    return null
  }
}
