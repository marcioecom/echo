"use client"

import { useQuery } from "@tanstack/react-query"
import { useCallback } from "react"

import { InboxApiError, inboxApiRequest } from "./api"

export interface MessageMediaUrl {
  url: string
  expiresAt: string
  mimeType: string
  durationMs: number | null
}

class MessageMediaUnavailableError extends Error {
  constructor() {
    super("message_media_not_found")
    this.name = "MessageMediaUnavailableError"
  }
}

function messageMediaQueryKey(conversationId: string, messageId: string) {
  return ["support-inbox", conversationId, "message-media", messageId] as const
}

/**
 * Signed media URLs expire after five minutes, so they are fetched on demand
 * (first play or replay after expiry) instead of with the timeline.
 */
export function useMessageMediaUrl({
  conversationId,
  messageId,
}: {
  conversationId: string
  messageId: string
}) {
  const { data, error, isFetching, refetch } = useQuery({
    queryKey: messageMediaQueryKey(conversationId, messageId),
    queryFn: async () => {
      try {
        return await inboxApiRequest<MessageMediaUrl>(
          `/v1/support-conversations/${conversationId}/messages/${messageId}/media`
        )
      } catch (requestError) {
        if (
          requestError instanceof InboxApiError &&
          requestError.status === 404
        ) {
          throw new MessageMediaUnavailableError()
        }
        throw requestError
      }
    },
    enabled: false,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  })

  const load = useCallback(() => {
    if (data && Date.parse(data.expiresAt) > Date.now()) return
    void refetch()
  }, [data, refetch])

  const isUnavailable = error instanceof MessageMediaUnavailableError

  return {
    url: data?.url ?? null,
    expiresAt: data?.expiresAt ?? null,
    isLoading: isFetching,
    error: isUnavailable ? null : error,
    isUnavailable,
    load,
  }
}
