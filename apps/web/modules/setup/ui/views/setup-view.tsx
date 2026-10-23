"use client"

import { ReloadIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Link } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import { useEffect, useRef, useState } from "react"

import { t } from "@/lib/i18n"
import { ChannelLiveProvider } from "@/modules/channels/hooks/use-channel-events"
import { BaileysPairingSession } from "@/modules/channels/ui/components/baileys-pairing-session"
import { ConnectChannelWizard } from "@/modules/channels/ui/components/connect-channel-wizard"
import { KnowledgeDocumentForm } from "@/modules/knowledge-base/ui/components/knowledge-document-form"

import { useFirstConversation } from "../../hooks/use-first-conversation"
import { useSetupState } from "../../hooks/use-setup-state"
import { Confetti } from "../components/confetti"
import { SetupChecklist } from "../components/setup-checklist"
import { SetupSuccess } from "../components/setup-success"
import { WaitingFirstMessage } from "../components/waiting-first-message"

type ActiveStep = "channel" | "channel-pending" | "knowledge" | null

export function SetupView({
  organizationId,
  canManage,
}: {
  organizationId: string
  canManage: boolean
}) {
  const state = useSetupState(organizationId)
  const first = useFirstConversation(
    organizationId,
    !state.isLoading && state.hasActiveChannel
  )
  const [activeStep, setActiveStep] = useState<ActiveStep>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  // Celebrate on the transition the operator is watching. Reloading a finished
  // setup shows the success screen without replaying the burst.
  const celebrationKey = `echo.setup.celebrated.${organizationId}`

  useEffect(() => {
    if (!activeStep) return
    panelRef.current?.scrollIntoView({ block: "nearest" })
    panelRef.current?.focus({ preventScroll: true })
  }, [activeStep])

  return (
    <ChannelLiveProvider organizationId={organizationId}>
      <div className="space-y-8">
        <Confetti active={first.exists} storageKey={celebrationKey} />

        {first.conversation ? (
          <SetupSuccess
            contactName={
              first.conversation.contact.displayName ??
              first.conversation.contact.address
            }
            conversationId={first.conversation.id}
            echoAnswered={first.echoAnswered}
          />
        ) : (
          <header className="space-y-2">
            <h1 className="text-xl font-semibold tracking-tight text-balance">
              {t("setup.pageTitle")}
            </h1>
            <p className="max-w-prose text-sm text-pretty text-muted-foreground">
              {t("setup.pageDescription")}
            </p>
          </header>
        )}

        {state.isLoading ? <SetupSkeleton /> : null}

        {state.isError ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-destructive" role="alert">
              {t("setup.errors.load")}
            </p>
            <Button onClick={state.refetch} size="sm" variant="outline">
              <HugeiconsIcon
                aria-hidden
                icon={ReloadIcon}
                size={14}
                strokeWidth={1.8}
              />
              {t("setup.actions.retry")}
            </Button>
          </div>
        ) : null}

        {!state.isLoading && !state.isError && !first.conversation ? (
          <>
            <SetupChecklist
              canManage={canManage}
              onSelectStep={(step) =>
                setActiveStep(
                  step === "channel" && state.hasPendingChannel
                    ? "channel-pending"
                    : step
                )
              }
              state={state}
            />

            <div
              className="scroll-mt-6 outline-none"
              ref={panelRef}
              tabIndex={-1}
            >
              {activeStep === "channel" ? (
                <ConnectChannelWizard
                  onClose={() => setActiveStep(null)}
                  organizationId={organizationId}
                  showProgress={false}
                />
              ) : null}

              {activeStep === "channel-pending" && state.pendingChannelId ? (
                <BaileysPairingSession
                  channelId={state.pendingChannelId}
                  intro={t("setup.steps.channel.pending")}
                  onDone={() => setActiveStep(null)}
                  organizationId={organizationId}
                  phoneNumber={state.channelAddress}
                />
              ) : null}

              {activeStep === "knowledge" ? (
                <KnowledgeDocumentForm
                  onCancel={() => setActiveStep(null)}
                  onDone={() => setActiveStep(null)}
                  organizationId={organizationId}
                />
              ) : null}
            </div>

            {state.hasActiveChannel && activeStep === null ? (
              <WaitingFirstMessage address={state.channelAddress} />
            ) : null}

            <Link
              className="inline-flex text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring/30"
              to="/inbox"
            >
              {t("setup.exitToInbox")}
            </Link>
          </>
        ) : null}
      </div>
    </ChannelLiveProvider>
  )
}

function SetupSkeleton() {
  return (
    <div
      aria-label={t("setup.progressLabel")}
      className="space-y-6"
      role="status"
    >
      <div className="space-y-2">
        <div className="h-3 w-40 animate-pulse rounded bg-muted" />
        <div className="h-1 w-full animate-pulse rounded-full bg-muted" />
      </div>
      <div className="space-y-4 border-y border-border py-4">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="flex items-start gap-3">
            <div className="size-6 animate-pulse rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="h-3 w-64 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
