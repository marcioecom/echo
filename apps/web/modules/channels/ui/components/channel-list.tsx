"use client"

import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import { useState } from "react"

import { t } from "@/lib/i18n"

import { useChannelLive } from "../../hooks/use-channel-events"
import { useChannels } from "../../hooks/use-channels"
import type { ChannelConnection } from "../../types"
import { ChannelRow } from "./channel-row"

export function ChannelList({ organizationId }: { organizationId: string }) {
  const query = useChannels(organizationId)
  const live = useChannelLive()
  const [pairingId, setPairingId] = useState<string | null>(null)
  const items = query.data?.items ?? []
  const pairingChannel = items.find((channel) => channel.id === pairingId)
  const visiblePairingId =
    pairingChannel?.status === "pending" ? pairingChannel.id : null
  const active = items.filter((channel) => channel.status !== "disabled")
  const archived = items.filter((channel) => channel.status === "disabled")

  return (
    <section aria-label={t("channels.title")} className="space-y-6">
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
      ) : (
        <>
          {active.length > 0 ? (
            <ChannelRows
              channels={active}
              onPairingDone={() => setPairingId(null)}
              onPairingStarted={setPairingId}
              organizationId={organizationId}
              pairingId={visiblePairingId}
            />
          ) : archived.length === 0 ? (
            <div className="rounded-md border border-dashed px-4 py-8 text-center">
              <p className="text-sm font-medium">{t("channels.emptyTitle")}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("channels.emptyBody")}
              </p>
            </div>
          ) : null}
          {archived.length > 0 ? (
            <div className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                {t("channels.archivedTitle")}
              </h2>
              <ChannelRows
                channels={archived}
                muted
                onPairingDone={() => setPairingId(null)}
                onPairingStarted={setPairingId}
                organizationId={organizationId}
                pairingId={visiblePairingId}
              />
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}

function ChannelRows({
  channels,
  organizationId,
  pairingId,
  onPairingStarted,
  onPairingDone,
  muted = false,
}: {
  channels: ChannelConnection[]
  organizationId: string
  pairingId: string | null
  onPairingStarted: (channelId: string) => void
  onPairingDone: () => void
  muted?: boolean
}) {
  return (
    <ul
      aria-live="polite"
      className={cn(
        "divide-y rounded-md border",
        muted && "bg-muted/40 text-muted-foreground"
      )}
    >
      {channels.map((channel) => (
        <ChannelRow
          channel={channel}
          key={channel.id}
          muted={muted}
          onPairingDone={onPairingDone}
          onPairingStarted={onPairingStarted}
          organizationId={organizationId}
          pairing={pairingId === channel.id}
        />
      ))}
    </ul>
  )
}

function connectionLabel(isFetching: boolean, live: boolean) {
  if (isFetching) return t("channels.refreshing")
  if (live) return t("channels.live")
  return t("channels.reconnecting")
}
