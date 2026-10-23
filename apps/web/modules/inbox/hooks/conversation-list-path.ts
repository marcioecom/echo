import type { InboxStatusFilter } from "../types"

/**
 * Builds the Support Inbox list path. `all` is a UI-only filter. The API takes
 * an optional concrete status, so sending `status=all` is a 400, not "no
 * filter".
 */
export function conversationListPath(input: {
  status?: InboxStatusFilter
  cursor?: string | null
  limit?: number
}): string {
  const params = new URLSearchParams()

  if (input.status && input.status !== "all") params.set("status", input.status)
  if (input.cursor) params.set("cursor", input.cursor)
  if (input.limit) params.set("limit", String(input.limit))

  const query = params.toString()

  return query
    ? `/v1/support-conversations?${query}`
    : "/v1/support-conversations"
}
