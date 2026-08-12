"use client"

import { useSearchParams } from "next/navigation"

import {
  useInboxConversation,
  useInboxConversations,
} from "../../hooks/use-inbox-conversations"
import { useInboxEvents } from "../../hooks/use-inbox-events"
import type { InboxStatusFilter } from "../../types"
import {
  ConversationDetail,
  EmptyConversationDetail,
} from "../components/conversation-detail"
import { ConversationList } from "../components/conversation-list"

const validStatuses = new Set<InboxStatusFilter>([
  "all",
  "open",
  "ai_active",
  "human_required",
  "resolved",
])

export function InboxView({
  organizationId,
  selectedConversationId,
}: {
  organizationId: string
  selectedConversationId: string | null
}) {
  const searchParams = useSearchParams()
  const requestedStatus = searchParams.get("status") ?? "all"
  const status = validStatuses.has(requestedStatus as InboxStatusFilter)
    ? (requestedStatus as InboxStatusFilter)
    : "all"
  const conversationsQuery = useInboxConversations(organizationId, status)
  const detailQuery = useInboxConversation(
    organizationId,
    selectedConversationId
  )
  useInboxEvents(organizationId)

  const conversations =
    conversationsQuery.data?.pages.flatMap((page) => page.items) ?? []

  return (
    <div className="flex h-[calc(100svh-10rem)] min-h-96 overflow-hidden rounded-lg border bg-background">
      <div
        className={
          selectedConversationId ? "hidden md:flex" : "flex flex-1 md:flex-none"
        }
      >
        <ConversationList
          conversations={conversations}
          selectedConversationId={selectedConversationId}
          status={status}
          isLoading={conversationsQuery.isPending}
          isError={conversationsQuery.isError}
          isFetchingNextPage={conversationsQuery.isFetchingNextPage}
          hasNextPage={conversationsQuery.hasNextPage}
          onRetry={() => conversationsQuery.refetch()}
          onLoadMore={() => conversationsQuery.fetchNextPage()}
        />
      </div>
      <div
        className={
          selectedConversationId
            ? "flex min-w-0 flex-1"
            : "hidden min-w-0 flex-1 md:flex"
        }
      >
        {selectedConversationId ? (
          <ConversationDetail
            organizationId={organizationId}
            detail={detailQuery.data}
            isLoading={detailQuery.isPending}
            error={detailQuery.error}
            onRetry={() => detailQuery.refetch()}
          />
        ) : (
          <EmptyConversationDetail />
        )}
      </div>
    </div>
  )
}
