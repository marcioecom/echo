"use client"

import { QrCodeIcon, WhatsappIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { useState } from "react"

import { t } from "@/lib/i18n"

import { BaileysPairingForm } from "./baileys-pairing-form"
import { TwilioConnectForm } from "./twilio-connect-form"

export function ConnectChannelWizard({
  organizationId,
  onClose,
  showProgress = true,
}: {
  organizationId: string
  onClose: () => void
  showProgress?: boolean
}) {
  const [step, setStep] = useState<"choose" | "twilio" | "baileys">("choose")
  const currentStep = step === "choose" ? 1 : 2
  const progress = showProgress ? (
    <WizardProgress current={currentStep} />
  ) : null

  if (step === "twilio") {
    return (
      <div className="space-y-3">
        {progress}
        <TwilioConnectForm
          onBack={() => setStep("choose")}
          onDone={onClose}
          organizationId={organizationId}
        />
      </div>
    )
  }

  if (step === "baileys") {
    return (
      <div className="space-y-3">
        {progress}
        <BaileysPairingForm
          onBack={() => setStep("choose")}
          onDone={onClose}
          organizationId={organizationId}
        />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {progress}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            {t("channels.chooseTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <button
            className="flex flex-col items-start gap-3 rounded-lg border border-primary bg-primary/5 p-4 text-left transition-colors duration-150 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/30"
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
            className="flex flex-col items-start gap-3 rounded-lg border bg-background p-4 text-left text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
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
              <span className="block text-sm font-medium text-foreground">
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
    </div>
  )
}

function WizardProgress({ current }: { current: number }) {
  const total = 2
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs text-muted-foreground">
        {t("channels.stepProgress", {
          current: String(current),
          total: String(total),
        })}
      </p>
      <div aria-hidden className="flex items-center gap-1.5">
        {Array.from({ length: total }, (_, index) => {
          const stepNumber = index + 1
          const active = stepNumber <= current
          return (
            <span
              className={
                active
                  ? "h-1.5 w-6 rounded-full bg-primary"
                  : "h-1.5 w-6 rounded-full bg-muted"
              }
              key={stepNumber}
            />
          )
        })}
      </div>
    </div>
  )
}
