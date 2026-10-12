"use client"

import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form"
import { Input } from "@workspace/ui/components/input"
import { useState } from "react"
import type { UseFormReturn } from "react-hook-form"

import { channelErrorMessage, humanChannelError } from "../../hooks/api"
import type { UpdateChannelValues } from "../../hooks/use-update-channel-form"
import type { ChannelsCopy, ChannelsLocale } from "../../i18n"
import type { ChannelConnection } from "../../types"

export function ChannelList({
  copy,
  locale,
  items,
  isLoading,
  isError,
  isFetching,
  live,
  onRetry,
  actionError,
  editingId,
  editForm,
  onEdit,
  onCancelEdit,
  onSubmitEdit,
  editPending,
  editError,
  onRemove,
  onActivate,
  pendingId,
}: {
  copy: ChannelsCopy
  locale: ChannelsLocale
  items: ChannelConnection[] | undefined
  isLoading: boolean
  isError: boolean
  isFetching: boolean
  live: boolean
  onRetry: () => void
  actionError: unknown
  editingId: string | null
  editForm: UseFormReturn<UpdateChannelValues>
  onEdit: (channel: ChannelConnection) => void
  onCancelEdit: () => void
  onSubmitEdit: (values: UpdateChannelValues) => void
  editPending: boolean
  editError: unknown
  onRemove: (channelConnectionId: string) => void
  onActivate: (channelConnectionId: string) => void
  pendingId: string | null
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  return (
    <section aria-label={copy.title} className="space-y-3">
      <div className="flex justify-end">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            aria-hidden
            className={cn(
              "size-1.5 rounded-full",
              live ? "bg-primary" : "bg-muted-foreground/50"
            )}
          />
          {statusLabel(copy, isFetching, live)}
        </span>
      </div>
      {actionError ? (
        <p className="text-sm text-destructive" role="alert">
          {channelErrorMessage(actionError, copy)}
        </p>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{copy.loading}</p>
      ) : isError ? (
        <div className="flex items-center gap-3">
          <p className="text-sm text-destructive" role="alert">
            {copy.loadError}
          </p>
          <Button onClick={onRetry} size="sm" variant="outline">
            {copy.retry}
          </Button>
        </div>
      ) : items && items.length > 0 ? (
        <ul aria-live="polite" className="divide-y rounded-md border">
          {items.map((channel) => {
            const label = channel.displayName?.trim() || channel.name
            const expanded = expandedId === channel.id
            const editing = editingId === channel.id
            return (
              <li key={channel.id} className="space-y-3 px-3 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{label}</p>
                      <ChannelStatusBadge channel={channel} copy={copy} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {copy.provider[channel.provider]}
                      {channel.address ? ` · ${channel.address}` : ""}
                      {" · "}
                      {channel.inboxId ?? copy.inboxEmpty}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      aria-expanded={expanded}
                      onClick={() =>
                        setExpandedId(expanded ? null : channel.id)
                      }
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      {expanded ? copy.hideDetails : copy.details}
                    </Button>
                    <Button
                      onClick={() => onEdit(channel)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {copy.edit}
                    </Button>
                    {channel.status === "disabled" ? (
                      <Button
                        disabled={pendingId === channel.id}
                        onClick={() => onActivate(channel.id)}
                        size="sm"
                        type="button"
                      >
                        {copy.activate}
                      </Button>
                    ) : (
                      <Button
                        disabled={pendingId === channel.id}
                        onClick={() => setConfirmingId(channel.id)}
                        size="sm"
                        type="button"
                        variant="destructive"
                      >
                        {copy.remove}
                      </Button>
                    )}
                  </div>
                </div>

                {editing ? (
                  <Form {...editForm}>
                    <form
                      className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
                      onSubmit={editForm.handleSubmit(onSubmitEdit)}
                    >
                      <FormField
                        control={editForm.control}
                        name="displayName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{copy.displayName}</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="inboxId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{copy.inboxId}</FormLabel>
                            <FormControl>
                              <Input
                                placeholder={copy.inboxPlaceholder}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex items-end gap-2">
                        <Button disabled={editPending} type="submit">
                          {editPending ? copy.saving : copy.save}
                        </Button>
                        <Button
                          onClick={onCancelEdit}
                          type="button"
                          variant="ghost"
                        >
                          {copy.cancel}
                        </Button>
                      </div>
                    </form>
                    {editError ? (
                      <p className="text-sm text-destructive" role="alert">
                        {channelErrorMessage(editError, copy)}
                      </p>
                    ) : null}
                  </Form>
                ) : null}

                {confirmingId === channel.id ? (
                  <div className="space-y-2 rounded-md bg-muted/50 px-3 py-2">
                    <p className="text-sm font-medium">{copy.confirmRemove}</p>
                    <p className="text-xs text-muted-foreground">
                      {copy.confirmRemoveBody}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        disabled={pendingId === channel.id}
                        onClick={() => {
                          onRemove(channel.id)
                          setConfirmingId(null)
                        }}
                        size="sm"
                        type="button"
                        variant="destructive"
                      >
                        {copy.confirm}
                      </Button>
                      <Button
                        onClick={() => setConfirmingId(null)}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        {copy.cancel}
                      </Button>
                    </div>
                  </div>
                ) : null}

                {expanded ? (
                  <ChannelDetails
                    channel={channel}
                    copy={copy}
                    locale={locale}
                  />
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="rounded-md border border-dashed px-4 py-8 text-center">
          <p className="text-sm font-medium">{copy.emptyTitle}</p>
          <p className="mt-1 text-sm text-muted-foreground">{copy.emptyBody}</p>
        </div>
      )}
    </section>
  )
}

function ChannelStatusBadge({
  channel,
  copy,
}: {
  channel: ChannelConnection
  copy: ChannelsCopy
}) {
  const tone = statusTone(channel)
  const label = channel.session
    ? copy.session[channel.session.state]
    : copy.status[channel.status]
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        tone === "positive" && "bg-primary/10 text-primary",
        tone === "warning" && "bg-warning/20 text-warning-foreground",
        tone === "danger" && "bg-destructive/10 text-destructive",
        tone === "muted" && "bg-muted text-muted-foreground"
      )}
    >
      {label}
    </span>
  )
}

function ChannelDetails({
  channel,
  copy,
  locale,
}: {
  channel: ChannelConnection
  copy: ChannelsCopy
  locale: ChannelsLocale
}) {
  const connectedAt = channel.session?.lastConnectedAt
  const error = channel.session?.lastError
  return (
    <dl className="grid gap-2 text-sm">
      <div>
        <dt className="text-xs text-muted-foreground">{copy.details}</dt>
        <dd>{statusSentence(channel, copy)}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">
          {connectedAt ? copy.lastConnected : copy.updatedAt}
        </dt>
        <dd>
          {formatWhen(connectedAt ?? channel.updatedAt, locale) ??
            copy.noLastConnection}
        </dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">{copy.lastError}</dt>
        <dd>{error ? humanChannelError(error, copy) : copy.noLastError}</dd>
      </div>
      {channel.webhookUrl ? (
        <div>
          <dt className="text-xs text-muted-foreground">{copy.webhookLabel}</dt>
          <dd className="font-mono text-xs break-all">{channel.webhookUrl}</dd>
        </div>
      ) : null}
    </dl>
  )
}

function statusLabel(copy: ChannelsCopy, isFetching: boolean, live: boolean) {
  if (isFetching) return copy.refreshing
  if (live) return copy.live
  return copy.reconnecting
}

function statusSentence(channel: ChannelConnection, copy: ChannelsCopy) {
  if (channel.status === "disabled") return copy.disabledSentence
  if (channel.status === "pending") return copy.pendingSentence
  if (channel.session?.state === "logged_out") return copy.session.logged_out
  if (channel.session?.state === "banned_suspected") {
    return copy.session.banned_suspected
  }
  if (channel.session?.state === "disconnected")
    return copy.session.disconnected
  return copy.connectedSentence
}

function statusTone(channel: ChannelConnection) {
  const state = channel.session?.state
  if (state === "logged_out" || state === "banned_suspected") return "danger"
  if (
    state === "connecting" ||
    state === "qr_pending" ||
    state === "pairing_code_pending" ||
    channel.status === "pending"
  ) {
    return "warning"
  }
  if (state === "connected" || channel.status === "active") return "positive"
  return "muted"
}

function formatWhen(value: string, locale: ChannelsLocale) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}
