"use client"

import { Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"

import { t } from "@/lib/i18n"

/**
 * Replaces the pairing UI the moment WhatsApp confirms the connection. Without
 * this swap the QR panel keeps rendering an empty square while the channel row
 * below already says "Connected".
 */
export function ChannelConnectedPanel({
  address,
  onContinue,
}: {
  address: string | null
  onContinue: () => void
}) {
  return (
    <section
      aria-live="polite"
      className="space-y-4 rounded-md border border-primary/20 bg-primary/5 p-4"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <HugeiconsIcon
            aria-hidden
            icon={Tick02Icon}
            size={16}
            strokeWidth={2}
          />
        </span>
        <div className="min-w-0 space-y-1">
          <h3 className="text-sm font-medium">
            {t("channels.qrConnectedTitle")}
          </h3>
          <p className="max-w-prose text-sm text-pretty text-muted-foreground">
            {address
              ? t("channels.qrConnectedBody", { address })
              : t("channels.qrConnectedBodyNoAddress")}
          </p>
        </div>
      </div>
      <Button onClick={onContinue} type="button">
        {t("channels.qrContinue")}
      </Button>
    </section>
  )
}
