"use client"

import type { InboxStatusFilter } from "../../types"

import { t } from "@/lib/i18n"
import { useSetupState } from "@/modules/setup/hooks/use-setup-state"
import { SetupChecklist } from "@/modules/setup/ui/components/setup-checklist"
import { WaitingFirstMessage } from "@/modules/setup/ui/components/waiting-first-message"
import { PageHeader } from "@/modules/shell/ui/page-header"

import { useConversationOpened } from "../../hooks/use-conversation-opened"
import {
  useInboxConversation,
  useInboxConversations,
  useInboxHasConversations,
} from "../../hooks/use-inbox-conversations"
import { useInboxEvents } from "../../hooks/use-inbox-events"
import { useInboxFilter } from "../../hooks/use-inbox-filter"
import {
  ConversationDetail,
  EmptyConversationDetail,
} from "../components/conversation-detail"
import { ConversationList } from "../components/conversation-list"

export function InboxView({
  organizationId,
  selectedConversationId,
  status,
  canManage,
}: {
  organizationId: string
  selectedConversationId: string | null
  status: InboxStatusFilter
  canManage: boolean
}) {
  const conversationsQuery = useInboxConversations(organizationId, status)
  const detailQuery = useInboxConversation(
    organizationId,
    selectedConversationId
  )
  const setup = useSetupState(organizationId)
  useInboxEvents(organizationId)
  const applyFilter = useInboxFilter(organizationId)
  useConversationOpened(organizationId, detailQuery.data?.conversation)

  const conversations =
    conversationsQuery.data?.pages.flatMap((page) => page.items) ?? []

  const anyConversations = useInboxHasConversations(
    organizationId,
    !setup.isLoading && conversations.length === 0
  )
  const hasAnyConversations =
    conversations.length > 0 || (anyConversations.data?.items.length ?? 0) > 0
  const signalReady = !anyConversations.isPending && !anyConversations.isError
  const listSettled = !conversationsQuery.isPending

  // The queue is empty for two reasons. Say which one it is instead
  // of offering "Show all" on a Support Inbox that has never received anything.
  const isFirstRun =
    listSettled &&
    signalReady &&
    !setup.hasActiveChannel &&
    !hasAnyConversations
  const isWaiting =
    listSettled && signalReady && setup.hasActiveChannel && !hasAnyConversations

  if (isFirstRun || isWaiting) {
    return (
      <div className="flex h-[calc(100svh-6rem)] flex-col md:h-[calc(100svh-4rem)]">
        <PageHeader className="mb-4 shrink-0" title={t("inbox.title")} />
        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-background">
          <div className="flex min-h-full items-center justify-center px-5 py-10 sm:px-8">
            <div className="w-full max-w-xl">
              {isFirstRun ? (
                <SetupChecklist
                  canManage={canManage}
                  state={setup}
                  variant="inline"
                />
              ) : (
                <WaitingFirstMessage address={setup.channelAddress} />
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100svh-6rem)] min-h-96 flex-col md:h-[calc(100svh-4rem)]">
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
            onFilterChange={applyFilter}
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
