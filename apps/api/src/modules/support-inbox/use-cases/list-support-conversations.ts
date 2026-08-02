import type { SupportConversationStatus } from "@workspace/domain"

import { err, ok } from "../../../common/result"
import { supportInboxRepository } from "../repositories/support-inbox-repository"
import { decodeSupportInboxCursor, encodeSupportInboxCursor } from "../schemas"
import type { SupportInboxCursor } from "../types"

export type ListSupportConversationsError = { type: "invalid_cursor" }

export async function listSupportConversations(input: {
  organizationId: string
  status?: SupportConversationStatus
  cursor?: string
  limit: number
}) {
  const decodedCursor = input.cursor
    ? decodeSupportInboxCursor(input.cursor)
    : null
  if (input.cursor && !decodedCursor) {
    return err({ type: "invalid_cursor" })
  }

  const cursor: SupportInboxCursor | undefined = decodedCursor ?? undefined
  const result = await supportInboxRepository.list({
    organizationId: input.organizationId,
    status: input.status,
    cursor,
    limit: input.limit,
  })
  const lastItem = result.items.at(-1)

  return ok({
    items: result.items.map((item) => ({
      ...item,
      lastActivityAt: item.lastActivityAt.toISOString(),
    })),
    nextCursor:
      result.hasMore && lastItem
        ? encodeSupportInboxCursor({
            lastActivityAt: lastItem.lastActivityAt,
            id: lastItem.id,
          })
        : null,
  })
}
