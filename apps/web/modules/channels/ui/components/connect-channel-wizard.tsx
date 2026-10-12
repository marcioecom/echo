"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { QrCodeIcon, WhatsappIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useState } from "react"

import { t } from "@/lib/i18n"

import { BaileysPairingForm } from "./baileys-pairing-form"
import { TwilioConnectForm } from "./twilio-connect-form"

export function ConnectChannelWizard({
  organizationId,
  onClose,
}: {
  organizationId: string
  onClose: () => void
}) {
  const [step, setStep] = useState<"choose" | "twilio" | "baileys">("choose")

  if (step === "twilio") {
    return (
      <TwilioConnectForm
        onBack={() => setStep("choose")}
        onDone={onClose}
        organizationId={organizationId}
      />
    )
  }

  if (step === "baileys") {
    return (
      <BaileysPairingForm
        onBack={() => setStep("choose")}
        onDone={onClose}
        organizationId={organizationId}
      />
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          {t("channels.chooseTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <button
          className="flex flex-col items-start gap-3 rounded-lg border border-primary/40 bg-background p-4 text-left transition-colors hover:bg-accent"
          onClick={() => setStep("twilio")}
          type="button"
        >
          <span className="flex w-full items-center justify-between gap-2">
            <HugeiconsIcon icon={WhatsappIcon} size={18} strokeWidth={1.8} />
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              {t("channels.recommended")}
            </span>
          </span>
          <span className="space-y-1">
            <span className="block text-sm font-medium">
              {t("channels.officialTitle")}
            </span>
            <span className="block text-xs text-pretty text-muted-foreground">
              {t("channels.officialBody")}
            </span>
          </span>
        </button>
        <button
          className="flex flex-col items-start gap-3 rounded-lg border bg-background p-4 text-left transition-colors hover:bg-accent"
          onClick={() => setStep("baileys")}
          type="button"
        >
          <span className="flex w-full items-center justify-between gap-2">
            <HugeiconsIcon icon={QrCodeIcon} size={18} strokeWidth={1.8} />
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {t("channels.beta")}
            </span>
          </span>
          <span className="space-y-1">
            <span className="block text-sm font-medium">
              {t("channels.qrTitle")}
            </span>
            <span className="block text-xs text-pretty text-muted-foreground">
              {t("channels.qrBody")}
            </span>
          </span>
        </button>
        <div className="sm:col-span-2">
          <Button onClick={onClose} type="button" variant="ghost">
            {t("channels.cancel")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
