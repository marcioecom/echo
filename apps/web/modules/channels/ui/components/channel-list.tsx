"use client"

import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"

import { t } from "@/lib/i18n"

import { channelErrorMessage } from "../../hooks/api"
import { useChannelLive } from "../../hooks/use-channel-events"
import { useChannels } from "../../hooks/use-channels"
import { ChannelRow } from "./channel-row"

export function ChannelList({ organizationId }: { organizationId: string }) {
  const { query, removeMutation, activateMutation } =
    useChannels(organizationId)
  const live = useChannelLive()
  const items = query.data?.items
  const pendingId = removeMutation.isPending
    ? removeMutation.variables
    : activateMutation.isPending
      ? activateMutation.variables
      : null
  const actionError = removeMutation.error ?? activateMutation.error

  return (
    <section aria-label={t("channels.title")} className="space-y-3">
      <div className="flex justify-end">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            aria-hidden
            className={cn(
              "size-1.5 rounded-full",
              live.connected ? "bg-primary" : "bg-muted-foreground/50"
            )}
          />
          {connectionLabel(query.isFetching, live.connected)}
        </span>
      </div>
      {actionError ? (
        <p className="text-sm text-destructive" role="alert">
          {channelErrorMessage(actionError)}
        </p>
      ) : null}

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("channels.loading")}</p>
      ) : query.isError ? (
        <div className="flex items-center gap-3">
          <p className="text-sm text-destructive" role="alert">
            {t("channels.loadError")}
          </p>
          <Button onClick={() => query.refetch()} size="sm" variant="outline">
            {t("channels.retry")}
          </Button>
        </div>
      ) : items && items.length > 0 ? (
        <ul aria-live="polite" className="divide-y rounded-md border">
          {items.map((channel) => (
            <ChannelRow
              channel={channel}
              key={channel.id}
              onActivate={() => activateMutation.mutate(channel.id)}
              onRemove={() => removeMutation.mutate(channel.id)}
              organizationId={organizationId}
              pending={pendingId === channel.id}
            />
          ))}
        </ul>
      ) : (
        <div className="rounded-md border border-dashed px-4 py-8 text-center">
          <p className="text-sm font-medium">{t("channels.emptyTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("channels.emptyBody")}
          </p>
        </div>
      )}
    </section>
  )
}

function connectionLabel(isFetching: boolean, live: boolean) {
  if (isFetching) return t("channels.refreshing")
  if (live) return t("channels.live")
  return t("channels.reconnecting")
}
