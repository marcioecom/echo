"use client"

import { t } from "@/lib/i18n"
import { PageHeader } from "@/modules/shell/ui/page-header"

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

export function InboxView({
  organizationId,
  selectedConversationId,
  status,
}: {
  organizationId: string
  selectedConversationId: string | null
  status: InboxStatusFilter
}) {
  const conversationsQuery = useInboxConversations(organizationId, status)
  const detailQuery = useInboxConversation(
    organizationId,
    selectedConversationId
  )
  useInboxEvents(organizationId)

  const conversations =
    conversationsQuery.data?.pages.flatMap((page) => page.items) ?? []

  return (
    <div className="flex h-[calc(100svh-5.5rem)] min-h-96 flex-col md:h-[calc(100svh-4rem)]">
      <PageHeader className="mb-4 shrink-0" title={t("inbox.title")} />
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-background">
        <div
          className={
            selectedConversationId
              ? "hidden md:flex"
              : "flex flex-1 md:flex-none"
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
    </div>
  )
}
