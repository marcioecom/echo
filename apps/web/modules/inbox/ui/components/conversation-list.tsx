"use client"

import type { InboxConversation, InboxStatusFilter } from "../../types"
import type { MessageKey } from "@/lib/i18n"
import type { ActorType } from "@workspace/domain"

import {
  AlertCircleIcon,
  Message01Icon,
  ReloadIcon,
  WhatsappIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Link, useNavigate } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { appLocale, t } from "@/lib/i18n"

import { ConversationStatus } from "./conversation-status"

const filters: Array<{ value: InboxStatusFilter; label: MessageKey }> = [
  { value: "human_required", label: "inbox.filter.human_required" },
  { value: "ai_active", label: "inbox.filter.ai_active" },
  { value: "open", label: "inbox.filter.open" },
  { value: "resolved", label: "inbox.filter.resolved" },
  { value: "all", label: "inbox.filter.all" },
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

function contactInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase()
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
  const showCount = !isLoading && !isError && conversations.length > 0

  return (
    <aside className="flex min-h-0 flex-col border-r border-border bg-sidebar md:w-80 lg:w-96">
      <div className="space-y-3 border-b border-border px-3 py-3">
        <div className="flex items-baseline justify-between gap-2 px-0.5">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-medium">{t("inbox.queueLabel")}</h2>
            {showCount ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                {t("inbox.queueCount", {
                  count: String(conversations.length),
                })}
                {hasNextPage ? "+" : ""}
              </span>
            ) : null}
          </div>
        </div>
        <div
          aria-label={t("inbox.filtersLabel")}
          className="inline-flex max-w-full overflow-x-auto rounded-md border border-border bg-background p-0.5"
          role="group"
        >
          {filters.map((filter) => {
            const active = status === filter.value
            return (
              <button
                aria-pressed={active}
                className={cn(
                  "shrink-0 rounded-[5px] px-2.5 py-1 text-xs transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                  active
                    ? "bg-accent font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
                key={filter.value}
                onClick={() => {
                  navigate({
                    to: ".",
                    search: { status: filter.value },
                  })
                }}
                type="button"
              >
                {t(filter.label)}
              </button>
            )
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isError && conversations.length > 0 ? (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 border-b border-border bg-destructive/5 px-4 py-2 text-xs text-destructive"
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
          <FilterEmptyState
            status={status}
            onShowAll={() => navigate({ to: ".", search: { status: "all" } })}
          />
        ) : null}
        <ul className="divide-y divide-border">
          {conversations.map((conversation) => {
            const selected = conversation.id === selectedConversationId
            const contactName =
              conversation.contact.displayName ?? conversation.contact.address
            const needsYou = conversation.status === "human_required"
            return (
              <li key={conversation.id}>
                <Link
                  to="/inbox/$conversationId"
                  params={{ conversationId: conversation.id }}
                  search={{ status }}
                  aria-current={selected ? "page" : undefined}
                  className={cn(
                    "block px-3 py-3 transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-inset",
                    selected ? "bg-accent" : "hover:bg-muted/40"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md text-[11px] font-medium tabular-nums",
                        needsYou
                          ? "bg-warning/20 text-warning-foreground"
                          : "bg-muted text-foreground"
                      )}
                      aria-hidden
                    >
                      {contactInitials(contactName)}
                    </span>
                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0 truncate text-sm font-medium text-foreground">
                          {contactName}
                        </span>
                        <time
                          className="shrink-0 text-[11px] text-muted-foreground tabular-nums"
                          dateTime={conversation.lastActivityAt}
                        >
                          {formatRelativeTime(conversation.lastActivityAt)}
                        </time>
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {conversation.lastMessage ? (
                          <>
                            <span className="text-foreground/70">
                              {senderLabel(conversation.lastMessage)}:
                            </span>{" "}
                            {conversation.lastMessage.preview}
                          </>
                        ) : (
                          t("inbox.noMessagesYet")
                        )}
                      </span>
                      <span className="flex items-center gap-2 pt-0.5">
                        <ConversationStatus status={conversation.status} />
                        {conversation.contact.displayName ? (
                          <span className="truncate font-mono text-[11px] text-muted-foreground">
                            {conversation.contact.address}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
        {hasNextPage ? (
          <div className="p-3 text-center">
            <Button
              variant="outline"
              size="sm"
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

const filterEmptyCopy = {
  all: {
    title: "inbox.filterEmpty.all.title",
    body: "inbox.filterEmpty.all.body",
  },
  open: {
    title: "inbox.filterEmpty.open.title",
    body: "inbox.filterEmpty.open.body",
  },
  ai_active: {
    title: "inbox.filterEmpty.ai_active.title",
    body: "inbox.filterEmpty.ai_active.body",
  },
  human_required: {
    title: "inbox.filterEmpty.human_required.title",
    body: "inbox.filterEmpty.human_required.body",
  },
  resolved: {
    title: "inbox.filterEmpty.resolved.title",
    body: "inbox.filterEmpty.resolved.body",
  },
} as const satisfies Record<
  InboxStatusFilter,
  { title: MessageKey; body: MessageKey }
>

function FilterEmptyState({
  status,
  onShowAll,
}: {
  status: InboxStatusFilter
  onShowAll: () => void
}) {
  const copy = filterEmptyCopy[status]
  const icon = status === "all" ? WhatsappIcon : Message01Icon

  return (
    <ListState
      icon={icon}
      title={t(copy.title)}
      description={t(copy.body)}
      action={
        status === "human_required" ? (
          <Button variant="outline" size="sm" onClick={onShowAll}>
            {t("inbox.filterEmpty.human_required.action")}
          </Button>
        ) : undefined
      }
    />
  )
}

function ConversationListSkeleton() {
  return (
    <div aria-label={t("inbox.loadingList")} className="divide-y divide-border">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="flex items-start gap-3 px-3 py-3">
          <div className="size-8 animate-pulse rounded-md bg-muted" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex justify-between gap-4">
              <div className="h-4 w-28 animate-pulse rounded bg-muted" />
              <div className="h-3 w-10 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-3 w-48 animate-pulse rounded bg-muted" />
            <div className="h-3 w-20 animate-pulse rounded bg-muted" />
          </div>
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
    <div className="m-3 flex flex-col items-center justify-center rounded-md border border-dashed border-border px-5 py-12 text-center">
      <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
        <HugeiconsIcon icon={icon} size={16} strokeWidth={1.8} />
      </div>
      <h3 className="mt-3 text-sm font-medium">{title}</h3>
      <p className="mt-1 max-w-64 text-xs text-pretty text-muted-foreground">
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
