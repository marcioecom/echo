"use client"

import { WhatsappIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "@workspace/ui/lib/utils"

import { t } from "@/lib/i18n"

export function WaitingFirstMessage({
  address,
  className,
}: {
  address: string | null
  className?: string
}) {
  return (
    <section className={cn("space-y-4", className)}>
      <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        <HugeiconsIcon
          aria-hidden
          icon={WhatsappIcon}
          size={18}
          strokeWidth={1.8}
        />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-base font-semibold tracking-tight text-balance">
          {t("setup.waiting.title")}
        </h2>
        <p className="max-w-prose text-sm text-pretty text-muted-foreground">
          {address ? t("setup.waiting.body") : t("setup.waiting.bodyNoAddress")}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("setup.waiting.live")}
        </p>
      </div>
      {address ? (
        <p className="inline-flex rounded-md border border-border bg-muted/40 px-3 py-1.5 font-mono text-sm text-foreground tabular-nums">
          {address}
        </p>
      ) : null}
    </section>
  )
}
