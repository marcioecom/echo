"use client"

import {
  AlertCircleIcon,
  Message01Icon,
  ReloadIcon,
  WhatsappIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Link, useNavigate } from "@tanstack/react-router"
import type { ActorType } from "@workspace/domain"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { appLocale, t, type MessageKey } from "@/lib/i18n"

import type { InboxConversation, InboxStatusFilter } from "../../types"
import { ConversationStatus } from "./conversation-status"

const filters: Array<{ value: InboxStatusFilter; label: MessageKey }> = [
  { value: "all", label: "inbox.filter.all" },
  { value: "open", label: "inbox.filter.open" },
  { value: "ai_active", label: "inbox.filter.ai_active" },
  { value: "human_required", label: "inbox.filter.human_required" },
  { value: "resolved", label: "inbox.filter.resolved" },
]

const senderKeys = {
  contact: "inbox.sender.contact",
  ai: "inbox.sender.ai",
  operator: "inbox.sender.operator",
  system: "inbox.sender.system",
} as const satisfies Record<ActorType, MessageKey>

function formatRelativeTime(value: string): string {
  const relativeTime = new Intl.RelativeTimeFormat(appLocale(), {
    numeric: "auto",
  })
  const difference = new Date(value).getTime() - Date.now()
  const minute = 60_000
  const hour = minute * 60
  const day = hour * 24
  if (Math.abs(difference) < hour)
    return relativeTime.format(Math.round(difference / minute), "minute")
  if (Math.abs(difference) < day)
    return relativeTime.format(Math.round(difference / hour), "hour")
  return relativeTime.format(Math.round(difference / day), "day")
}

function senderLabel(sender: NonNullable<InboxConversation["lastMessage"]>) {
  return t(senderKeys[sender.senderType])
}

export function ConversationList({
  conversations,
  selectedConversationId,
  status,
  isLoading,
  isError,
  isFetchingNextPage,
  hasNextPage,
  onRetry,
  onLoadMore,
}: {
  conversations: InboxConversation[]
  selectedConversationId: string | null
  status: InboxStatusFilter
  isLoading: boolean
  isError: boolean
  isFetchingNextPage: boolean
  hasNextPage: boolean
  onRetry: () => void
  onLoadMore: () => void
}) {
  const navigate = useNavigate()

  return (
    <aside className="flex min-h-0 flex-col border-r bg-background md:w-80 lg:w-96">
      <div className="border-b px-3 py-3">
        <div
          className="flex gap-1 overflow-x-auto"
          aria-label={t("inbox.filtersLabel")}
        >
          {filters.map((filter) => (
            <Button
              key={filter.value}
              variant={status === filter.value ? "secondary" : "ghost"}
              size="sm"
              onClick={() => {
                navigate({
                  to: ".",
                  search: { status: filter.value },
                })
              }}
            >
              {t(filter.label)}
            </Button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isError && conversations.length > 0 ? (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 border-b bg-destructive/5 px-4 py-2 text-xs text-destructive"
          >
            <span>{t("inbox.staleError")}</span>
            <Button variant="ghost" size="sm" onClick={onRetry}>
              {t("inbox.retry")}
            </Button>
          </div>
        ) : null}
        {isLoading ? <ConversationListSkeleton /> : null}
        {isError && !conversations.length ? (
          <ListState
            icon={AlertCircleIcon}
            title={t("inbox.unavailableTitle")}
            description={t("inbox.unavailableBody")}
            action={
              <Button
                variant="outline"
                onClick={onRetry}
                data-icon="inline-start"
              >
                <HugeiconsIcon icon={ReloadIcon} />
                {t("inbox.tryAgain")}
              </Button>
            }
          />
        ) : null}
        {!isLoading && !isError && conversations.length === 0 ? (
          <ListState
            icon={WhatsappIcon}
            title={t("inbox.emptyTitle")}
            description={t("inbox.emptyBody")}
          />
        ) : null}
        {conversations.map((conversation) => {
          const selected = conversation.id === selectedConversationId
          const contactName =
            conversation.contact.displayName ?? conversation.contact.address
          return (
            <Link
              key={conversation.id}
              to="/inbox/$conversationId"
              params={{ conversationId: conversation.id }}
              search={{ status }}
              aria-current={selected ? "page" : undefined}
              className={cn(
                "block border-b px-4 py-3 transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-inset",
                selected ? "bg-accent" : "hover:bg-muted/60"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 truncate text-sm font-medium">
                  {contactName}
                </p>
                <time
                  className="shrink-0 text-[11px] text-muted-foreground tabular-nums"
                  dateTime={conversation.lastActivityAt}
                >
                  {formatRelativeTime(conversation.lastActivityAt)}
                </time>
              </div>
              {conversation.contact.displayName ? (
                <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                  {conversation.contact.address}
                </p>
              ) : null}
              <p className="mt-2 truncate text-xs text-muted-foreground">
                {conversation.lastMessage?.preview ?? t("inbox.noMessagesYet")}
              </p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <ConversationStatus status={conversation.status} />
                {conversation.lastMessage ? (
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <HugeiconsIcon
                      icon={Message01Icon}
                      size={12}
                      strokeWidth={1.8}
                    />
                    {senderLabel(conversation.lastMessage)}
                  </span>
                ) : null}
              </div>
            </Link>
          )
        })}
        {hasNextPage ? (
          <div className="p-3 text-center">
            <Button
              variant="outline"
              disabled={isFetchingNextPage}
              onClick={onLoadMore}
            >
              {isFetchingNextPage
                ? t("inbox.loadingMore")
                : t("inbox.loadMore")}
            </Button>
          </div>
        ) : null}
      </div>
    </aside>
  )
}

function ConversationListSkeleton() {
  return (
    <div aria-label={t("inbox.loadingList")} className="divide-y">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="space-y-2 px-4 py-3">
          <div className="flex justify-between gap-4">
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            <div className="h-3 w-12 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-3 w-48 animate-pulse rounded bg-muted" />
          <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}

function ListState({
  icon,
  title,
  description,
  action,
}: {
  icon: typeof WhatsappIcon
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="m-4 flex flex-col items-center justify-center rounded-lg border border-dashed px-5 py-12 text-center">
      <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
        <HugeiconsIcon icon={icon} size={16} strokeWidth={1.8} />
      </div>
      <h2 className="mt-3 text-sm font-medium">{title}</h2>
      <p className="mt-1 max-w-64 text-xs text-pretty text-muted-foreground">
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
