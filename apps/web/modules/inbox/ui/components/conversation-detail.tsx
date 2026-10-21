"use client"

import type { InboxConversationDetail } from "../../types"
import type { MessageKey } from "@/lib/i18n"
import type {
  ActorType,
  MessageStatus,
  SupportConversationHandoffReason,
} from "@workspace/domain"

import {
  AlertCircleIcon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowUp01Icon,
  BotIcon,
  CheckmarkCircle01Icon,
  Clock01Icon,
  Message01Icon,
  Note01Icon,
  ReloadIcon,
  UserIcon,
  WhatsappIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Link } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { useEffect, useId, useRef, useState } from "react"

import { appLocale, t } from "@/lib/i18n"

import { InboxApiError } from "../../hooks/api"
import { useTimelineAutoScroll } from "../../hooks/use-timeline-auto-scroll"
import { AudioMessage } from "./audio-message"
import { ConversationStatus } from "./conversation-status"
import { ReplyComposer } from "./reply-composer"

const handoffReasonKeys = {
  human_requested: "inbox.handoff.reason.human_requested",
  low_confidence: "inbox.handoff.reason.low_confidence",
  unsupported_policy: "inbox.handoff.reason.unsupported_policy",
  ai_failure: "inbox.handoff.reason.ai_failure",
  unsupported_content: "inbox.handoff.reason.unsupported_content",
  transcription_failed: "inbox.handoff.reason.transcription_failed",
  operator_takeover: "inbox.handoff.reason.operator_takeover",
} as const satisfies Record<SupportConversationHandoffReason, MessageKey>

const actorKeys = {
  contact: "inbox.sender.contact",
  ai: "inbox.sender.echo",
  operator: "inbox.sender.operator",
  system: "inbox.sender.system",
} as const satisfies Record<ActorType, MessageKey>

const deliveryKeys = {
  pending: "inbox.delivery.pending",
  sent: "inbox.delivery.sent",
  delivered: "inbox.delivery.delivered",
  read: "inbox.delivery.read",
  failed: "inbox.delivery.failed",
} as const satisfies Record<Exclude<MessageStatus, "received">, MessageKey>

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(appLocale(), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function buildTimeline(detail: InboxConversationDetail) {
  return [
    ...detail.messages.map((message) => ({
      kind: "message" as const,
      id: message.id,
      occurredAt: message.occurredAt,
      message,
    })),
    ...detail.events.map((event) => ({
      kind: "event" as const,
      id: event.id,
      occurredAt: event.occurredAt,
      event,
    })),
  ].sort((left, right) => {
    const byTime = left.occurredAt.localeCompare(right.occurredAt)
    return byTime === 0 ? left.id.localeCompare(right.id) : byTime
  })
}

function contactInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase()
}

export function ConversationDetail({
  organizationId,
  detail,
  isLoading,
  error,
  onRetry,
}: {
  organizationId: string
  detail: InboxConversationDetail | undefined
  isLoading: boolean
  error: Error | null
  onRetry: () => void
}) {
  const conversationId = detail?.conversation.id ?? null
  const timeline = detail ? buildTimeline(detail) : []
  const timelineRef = useTimelineAutoScroll(
    conversationId,
    timeline.at(-1)?.id ?? null
  )

  if (isLoading) return <ConversationDetailSkeleton />
  if (error && !detail) {
    const notFound = error instanceof InboxApiError && error.status === 404
    return (
      <DetailState
        icon={AlertCircleIcon}
        title={
          notFound
            ? t("inbox.notFoundTitle")
            : t("inbox.unavailableDetailTitle")
        }
        description={
          notFound ? t("inbox.notFoundBody") : t("inbox.unavailableDetailBody")
        }
        action={
          notFound ? (
            <Button asChild variant="outline">
              <Link to="/inbox">{t("inbox.back")}</Link>
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={onRetry}
              data-icon="inline-start"
            >
              <HugeiconsIcon icon={ReloadIcon} />
              {t("inbox.tryAgain")}
            </Button>
          )
        }
      />
    )
  }
  if (!detail) return null

  const contactName =
    detail.conversation.contact.displayName ??
    detail.conversation.contact.address
  const needsYou = detail.conversation.status === "human_required"

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      <header className="flex min-h-14 items-center gap-3 border-b border-border px-4 py-3">
        <Button asChild variant="ghost" size="icon" className="md:hidden">
          <Link to="/inbox" aria-label={t("inbox.back")}>
            <HugeiconsIcon icon={ArrowLeft01Icon} />
          </Link>
        </Button>
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-md text-[11px] font-medium tabular-nums",
            needsYou
              ? "bg-warning/20 text-warning-foreground"
              : "bg-muted text-foreground"
          )}
          aria-hidden
        >
          {contactInitials(contactName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-sm font-semibold tracking-tight">
              {contactName}
            </h2>
            <ConversationStatus status={detail.conversation.status} />
          </div>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
            <HugeiconsIcon icon={WhatsappIcon} size={12} strokeWidth={1.8} />
            <span className="font-mono">
              {detail.conversation.contact.address}
            </span>
            <span aria-hidden>·</span>
            <span>{detail.conversation.channelConnection.name}</span>
          </p>
        </div>
      </header>

      {error ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 border-b border-border bg-destructive/5 px-4 py-2 text-xs text-destructive"
        >
          <span>{t("inbox.newMessagesError")}</span>
          <Button variant="ghost" size="sm" onClick={onRetry}>
            {t("inbox.retry")}
          </Button>
        </div>
      ) : null}

      {detail.conversation.handoffReason ? (
        <HandoffSummary
          reason={detail.conversation.handoffReason}
          summary={detail.conversation.handoffSummary}
          active={needsYou}
        />
      ) : null}

      {/* `relative` keeps absolutely positioned sr-only labels inside this
          scroller; otherwise they anchor to the page and stretch it. */}
      <div
        ref={timelineRef}
        className="relative min-h-0 flex-1 overflow-y-auto bg-muted/20 px-4 py-5 sm:px-6"
        role="log"
        aria-label={t("inbox.messagesLabel")}
      >
        {timeline.length === 0 ? (
          <DetailState
            icon={Message01Icon}
            title={t("inbox.noMessagesTitle")}
            description={t("inbox.noMessagesBody")}
          />
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-3">
            {timeline.map((item) => {
              if (item.kind === "event") {
                return <HandoffTimelineEvent key={item.id} event={item.event} />
              }
              const message = item.message
              const outbound = message.direction === "outbound"
              const isAi = message.senderType === "ai"
              const isSystem = message.senderType === "system"
              const senderName =
                message.senderType === "contact"
                  ? contactName
                  : message.senderType === "operator"
                    ? (message.operatorName ?? t("inbox.sender.operator"))
                    : message.senderType === "ai"
                      ? t("inbox.sender.echo")
                      : t("inbox.sender.system")
              return (
                <article
                  key={message.id}
                  className={cn(
                    "flex gap-2.5",
                    outbound && "flex-row-reverse",
                    isSystem && "justify-center"
                  )}
                >
                  {isSystem ? null : (
                    <div
                      className={cn(
                        "mt-5 flex size-7 shrink-0 items-center justify-center rounded-full",
                        isAi
                          ? "bg-primary/10 text-primary"
                          : outbound
                            ? "bg-primary text-primary-foreground"
                            : "bg-background text-muted-foreground ring-1 ring-border"
                      )}
                    >
                      <HugeiconsIcon
                        icon={isAi ? BotIcon : UserIcon}
                        size={13}
                        strokeWidth={1.8}
                      />
                    </div>
                  )}
                  <div
                    className={cn(
                      isSystem ? "max-w-md text-center" : "max-w-[78%]",
                      outbound && !isSystem && "text-right"
                    )}
                  >
                    {isSystem ? null : (
                      <div
                        className={cn(
                          "mb-1 flex items-center gap-2 text-[11px] text-muted-foreground",
                          outbound && "justify-end"
                        )}
                      >
                        <span className="font-medium text-foreground">
                          {senderName}
                        </span>
                        <time
                          dateTime={message.occurredAt}
                          className="tabular-nums"
                        >
                          {formatTimestamp(message.occurredAt)}
                        </time>
                      </div>
                    )}
                    <div
                      className={cn(
                        "text-left text-sm break-words whitespace-pre-wrap",
                        isSystem
                          ? "rounded-md px-3 py-1.5 text-center text-xs text-muted-foreground"
                          : "rounded-lg px-3 py-2",
                        !isSystem &&
                          isAi &&
                          "bg-primary/10 text-foreground ring-1 ring-primary/20",
                        !isSystem &&
                          outbound &&
                          !isAi &&
                          "bg-primary text-primary-foreground",
                        !isSystem &&
                          !outbound &&
                          "bg-background text-foreground ring-1 ring-border"
                      )}
                    >
                      {message.contentType === "unsupported" ? (
                        <span className="italic opacity-80">
                          {t("inbox.unsupported")}
                        </span>
                      ) : message.contentType === "audio" ? (
                        <AudioMessage
                          conversationId={detail.conversation.id}
                          inverted={outbound && !isAi}
                          message={message}
                          senderName={senderName}
                        />
                      ) : (
                        message.body
                      )}
                    </div>
                    {isSystem ? (
                      <time
                        dateTime={message.occurredAt}
                        className="mt-1 block text-[10px] text-muted-foreground tabular-nums"
                      >
                        {formatTimestamp(message.occurredAt)}
                      </time>
                    ) : null}
                    {message.direction === "outbound" && !isSystem ? (
                      <MessageDeliveryStatus status={message.status} />
                    ) : null}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
      <ReplyComposer
        organizationId={organizationId}
        conversationId={detail.conversation.id}
        disabled={detail.conversation.status === "resolved"}
      />
    </section>
  )
}

function HandoffSummary({
  reason,
  summary,
  active,
}: {
  reason: SupportConversationHandoffReason
  summary: string | null
  active: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [isClamped, setIsClamped] = useState(false)
  const summaryRef = useRef<HTMLParagraphElement>(null)
  const summaryId = useId()

  useEffect(() => {
    if (expanded) return
    const element = summaryRef.current
    if (!element) return

    const measure = () => {
      setIsClamped(element.scrollHeight - element.clientHeight > 1)
    }
    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [summary, expanded])

  return (
    <aside className="border-b border-border bg-background px-4 py-2.5 sm:px-6 sm:py-3">
      <div
        className={cn(
          "mx-auto max-w-3xl rounded-lg px-3.5 py-2.5 sm:py-3",
          active
            ? "bg-warning/15 ring-1 ring-warning/25"
            : "bg-muted/50 ring-1 ring-border"
        )}
      >
        <div className="flex items-start gap-2.5">
          <div
            className={cn(
              "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md",
              active
                ? "bg-warning/25 text-warning-foreground"
                : "bg-background text-muted-foreground ring-1 ring-border"
            )}
            aria-hidden
          >
            <HugeiconsIcon icon={Note01Icon} size={14} strokeWidth={1.8} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p
                className={cn(
                  "text-xs font-semibold tracking-tight",
                  active ? "text-warning-foreground" : "text-foreground"
                )}
              >
                {t("inbox.handoff.summaryTitle")}
              </p>
              <span
                className={cn(
                  "inline-flex max-w-full truncate rounded-full px-2 py-0.5 text-[10px] font-medium",
                  active
                    ? "bg-warning/30 text-warning-foreground"
                    : "bg-background text-muted-foreground ring-1 ring-border"
                )}
              >
                {t(handoffReasonKeys[reason])}
              </span>
            </div>
            <p
              className={cn(
                "mt-1.5 text-sm leading-relaxed text-pretty whitespace-pre-wrap",
                !expanded && "line-clamp-2 md:line-clamp-none",
                active ? "text-warning-foreground" : "text-foreground"
              )}
              id={summaryId}
              ref={summaryRef}
            >
              {summary ?? t("inbox.handoff.summaryEmpty")}
            </p>
            {isClamped ? (
              <button
                aria-controls={summaryId}
                aria-expanded={expanded}
                className={cn(
                  "mt-1 inline-flex items-center gap-1 rounded-md py-1 text-[11px] font-medium underline-offset-2 transition-colors hover:underline focus-visible:ring-2 focus-visible:outline-none md:hidden",
                  active
                    ? "text-warning-foreground focus-visible:ring-warning-foreground/40"
                    : "text-muted-foreground hover:text-foreground focus-visible:ring-ring/40"
                )}
                onClick={() => setExpanded((value) => !value)}
                type="button"
              >
                <HugeiconsIcon
                  aria-hidden="true"
                  icon={expanded ? ArrowUp01Icon : ArrowDown01Icon}
                  size={12}
                  strokeWidth={1.8}
                />
                {expanded
                  ? t("inbox.handoff.summaryHide")
                  : t("inbox.handoff.summaryShow")}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </aside>
  )
}

function HandoffTimelineEvent({
  event,
}: {
  event: InboxConversationDetail["events"][number]
}) {
  const fromAi = event.actorType === "ai"
  return (
    <article className="flex items-center gap-3 py-1">
      <div className="h-px flex-1 bg-border" aria-hidden />
      <div className="flex max-w-[min(100%,20rem)] flex-col items-center gap-0.5 text-center">
        <p className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground">
          {fromAi ? (
            <span className="text-primary">
              <HugeiconsIcon icon={BotIcon} size={12} strokeWidth={1.8} />
            </span>
          ) : null}
          <span className="font-medium text-foreground/80">
            {t(actorKeys[event.actorType])}
          </span>
          <span aria-hidden>·</span>
          <span>{t("inbox.handoff.event")}</span>
        </p>
        <time
          dateTime={event.occurredAt}
          className="text-[10px] text-muted-foreground tabular-nums"
        >
          {formatTimestamp(event.occurredAt)}
        </time>
      </div>
      <div className="h-px flex-1 bg-border" aria-hidden />
    </article>
  )
}

function MessageDeliveryStatus({
  status,
}: {
  status: InboxConversationDetail["messages"][number]["status"]
}) {
  if (status === "received") return null
  const failed = status === "failed"
  return (
    <p
      className={cn(
        "mt-1 flex items-center justify-end gap-1 text-[10px]",
        failed ? "text-destructive" : "text-muted-foreground"
      )}
    >
      <HugeiconsIcon
        icon={
          failed
            ? AlertCircleIcon
            : status === "pending"
              ? Clock01Icon
              : CheckmarkCircle01Icon
        }
        size={11}
        strokeWidth={1.8}
      />
      {t(deliveryKeys[status])}
    </p>
  )
}

export function EmptyConversationDetail() {
  return (
    <DetailState
      icon={Message01Icon}
      title={t("inbox.selectTitle")}
      description={t("inbox.selectBody")}
    />
  )
}

function ConversationDetailSkeleton() {
  return (
    <section
      className="flex flex-1 flex-col bg-background"
      aria-label={t("inbox.loadingDetail")}
    >
      <div className="flex h-14 items-center gap-3 border-b border-border px-4">
        <div className="size-9 animate-pulse rounded-md bg-muted" />
        <div className="space-y-2">
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="h-3 w-48 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 bg-muted/20 px-6 py-8">
        <div className="h-16 w-3/5 animate-pulse rounded-lg bg-muted" />
        <div className="ml-auto h-20 w-2/3 animate-pulse rounded-lg bg-muted" />
        <div className="h-14 w-1/2 animate-pulse rounded-lg bg-muted" />
      </div>
    </section>
  )
}

function DetailState({
  icon,
  title,
  description,
  action,
}: {
  icon: typeof Message01Icon
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        <HugeiconsIcon icon={icon} size={18} strokeWidth={1.8} />
      </div>
      <h2 className="mt-4 text-sm font-medium">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-pretty text-muted-foreground">
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
