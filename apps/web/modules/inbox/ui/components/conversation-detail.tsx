"use client"

import {
  AlertCircleIcon,
  ArrowLeft01Icon,
  BotIcon,
  Message01Icon,
  ReloadIcon,
  UserIcon,
  WhatsappIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"

import { InboxApiError } from "../../hooks/api"
import type { InboxConversationDetail } from "../../types"
import { ConversationStatus } from "./conversation-status"

const timestamp = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
})

export function ConversationDetail({
  detail,
  isLoading,
  error,
  onRetry,
}: {
  detail: InboxConversationDetail | undefined
  isLoading: boolean
  error: Error | null
  onRetry: () => void
}) {
  if (isLoading) return <ConversationDetailSkeleton />
  if (error && !detail) {
    const notFound = error instanceof InboxApiError && error.status === 404
    return (
      <DetailState
        icon={AlertCircleIcon}
        title={notFound ? "Conversation not found" : "Conversation unavailable"}
        description={
          notFound
            ? "It may have been removed or belongs to another Organization."
            : "The message timeline could not be loaded."
        }
        action={
          notFound ? (
            <Button asChild variant="outline">
              <Link href="/inbox">Back to inbox</Link>
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={onRetry}
              data-icon="inline-start"
            >
              <HugeiconsIcon icon={ReloadIcon} />
              Try again
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

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-muted/20">
      <header className="flex min-h-16 items-center gap-3 border-b bg-background px-4 py-3">
        <Button asChild variant="ghost" size="icon" className="md:hidden">
          <Link href="/inbox" aria-label="Back to inbox">
            <HugeiconsIcon icon={ArrowLeft01Icon} />
          </Link>
        </Button>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <HugeiconsIcon icon={UserIcon} size={16} strokeWidth={1.8} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-sm font-semibold">{contactName}</h2>
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
          className="flex items-center justify-between gap-3 border-b bg-destructive/5 px-4 py-2 text-xs text-destructive"
        >
          <span>New messages could not be loaded.</span>
          <Button variant="ghost" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : null}

      <div
        className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6"
        role="log"
        aria-label="Conversation messages"
      >
        {detail.messages.length === 0 ? (
          <DetailState
            icon={Message01Icon}
            title="No messages"
            description="Messages in this Support Conversation will appear here."
          />
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-4">
            {detail.messages.map((message) => {
              const outbound = message.direction === "outbound"
              const senderName =
                message.senderType === "contact"
                  ? contactName
                  : message.senderType === "operator"
                    ? (message.operatorName ?? "Operator")
                    : message.senderType === "ai"
                      ? "Echo AI"
                      : "System"
              return (
                <article
                  key={message.id}
                  className={cn("flex gap-2.5", outbound && "flex-row-reverse")}
                >
                  <div
                    className={cn(
                      "mt-5 flex size-7 shrink-0 items-center justify-center rounded-full",
                      outbound
                        ? "bg-foreground text-background"
                        : "bg-background text-muted-foreground ring-1 ring-border"
                    )}
                  >
                    <HugeiconsIcon
                      icon={message.senderType === "ai" ? BotIcon : UserIcon}
                      size={13}
                      strokeWidth={1.8}
                    />
                  </div>
                  <div className={cn("max-w-[78%]", outbound && "text-right")}>
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
                        {timestamp.format(new Date(message.occurredAt))}
                      </time>
                    </div>
                    <div
                      className={cn(
                        "rounded-lg px-3 py-2 text-left text-sm whitespace-pre-wrap",
                        outbound
                          ? "bg-foreground text-background"
                          : "bg-background ring-1 ring-border"
                      )}
                    >
                      {message.contentType === "unsupported" ? (
                        <span className="italic opacity-80">
                          Unsupported attachment
                        </span>
                      ) : (
                        message.body
                      )}
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground capitalize">
                      {message.status}
                    </p>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

export function EmptyConversationDetail() {
  return (
    <DetailState
      icon={Message01Icon}
      title="Select a conversation"
      description="Choose a Support Conversation from the queue to read its message timeline."
    />
  )
}

function ConversationDetailSkeleton() {
  return (
    <section
      className="flex flex-1 flex-col bg-muted/20"
      aria-label="Loading conversation"
    >
      <div className="flex h-16 items-center gap-3 border-b bg-background px-4">
        <div className="size-9 animate-pulse rounded-full bg-muted" />
        <div className="space-y-2">
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="h-3 w-48 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-6 py-8">
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
