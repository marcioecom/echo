"use client"

import { Button } from "@workspace/ui/components/button"

import { t } from "@/lib/i18n"

import { humanChannelError } from "../../hooks/api"
import type { BaileysQrWait } from "../../hooks/use-baileys-qr-wait"
import { BaileysQrImage } from "./baileys-qr-image"

export function BaileysQrPanel({
  wait,
  retryPending = false,
  onRetry,
}: {
  wait: BaileysQrWait
  retryPending?: boolean
  onRetry?: () => void
}) {
  if (wait.status === "ready") {
    return <BaileysQrImage alt={t("channels.qrScan")} value={wait.qr} />
  }

  if (wait.status === "failed") {
    return (
      <div className="space-y-3 rounded-md border border-destructive/20 bg-destructive/5 p-3">
        <p className="text-sm text-destructive" role="alert">
          {humanChannelError(wait.reason)}
        </p>
        {onRetry ? (
          <Button
            disabled={retryPending}
            onClick={onRetry}
            size="sm"
            type="button"
            variant="outline"
          >
            {retryPending ? t("channels.qrRetrying") : t("channels.qrRetry")}
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <div
      aria-busy="true"
      aria-label={t("channels.qrWaiting")}
      className="space-y-2"
    >
      <div className="size-60 animate-pulse rounded-md border bg-muted" />
      <p className="text-sm text-muted-foreground">{t("channels.qrWaiting")}</p>
    </div>
  )
}
