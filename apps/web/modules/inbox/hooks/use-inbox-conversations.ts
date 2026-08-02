"use client"

import { useInfiniteQuery, useQuery } from "@tanstack/react-query"

import type {
  InboxConversationDetail,
  InboxConversationPage,
  InboxStatusFilter,
} from "../types"
import { inboxApiRequest } from "./api"

export const inboxQueryKeys = {
  all: (organizationId: string) => ["support-inbox", organizationId] as const,
  lists: (organizationId: string) =>
    [...inboxQueryKeys.all(organizationId), "list"] as const,
  list: (organizationId: string, status: InboxStatusFilter) =>
    [...inboxQueryKeys.lists(organizationId), status] as const,
  details: (organizationId: string) =>
    [...inboxQueryKeys.all(organizationId), "detail"] as const,
  detail: (organizationId: string, conversationId: string) =>
    [...inboxQueryKeys.details(organizationId), conversationId] as const,
}

export function useInboxConversations(
  organizationId: string,
  status: InboxStatusFilter
) {
  return useInfiniteQuery({
    queryKey: inboxQueryKeys.list(organizationId, status),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams()
      if (status !== "all") params.set("status", status)
      if (pageParam) params.set("cursor", pageParam)
      return inboxApiRequest<InboxConversationPage>(
        `/v1/support-conversations?${params.toString()}`
      )
    },
    getNextPageParam: (page) => page.nextCursor,
  })
}

export function useInboxConversation(
  organizationId: string,
  conversationId: string | null
) {
  return useQuery({
    queryKey: inboxQueryKeys.detail(organizationId, conversationId ?? "none"),
    queryFn: () =>
      inboxApiRequest<InboxConversationDetail>(
        `/v1/support-conversations/${conversationId}`
      ),
    enabled: conversationId !== null,
  })
}
