"use client"

import type { SetupState, SetupStep } from "../../state"

import { Loading03Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Link } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { t } from "@/lib/i18n"

export function SetupChecklist({
  state,
  canManage,
  variant = "page",
  className,
  onSelectStep,
}: {
  state: SetupState
  canManage: boolean
  variant?: "page" | "inline"
  className?: string
  onSelectStep?: (step: "channel" | "knowledge") => void
}) {
  return (
    <section className={cn("space-y-6", className)}>
      {variant === "inline" ? (
        <header className="space-y-1.5">
          <h2 className="text-base font-semibold tracking-tight text-balance">
            {t("setup.inbox.title")}
          </h2>
          <p className="max-w-prose text-sm text-pretty text-muted-foreground">
            {t("setup.inbox.body")}
          </p>
        </header>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
          <span>{t("setup.progressLabel")}</span>
          <span aria-live="polite" className="tabular-nums">
            {t("setup.progress", {
              done: String(state.completedSteps),
              total: String(state.totalSteps),
            })}
          </span>
        </div>
        <div aria-hidden className="flex gap-1">
          {Array.from({ length: state.totalSteps }, (_, index) => (
            <span
              key={index}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors duration-150",
                index < state.completedSteps ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>
      </div>

      <ul className="divide-y divide-border border-y border-border">
        {state.steps.map((step, index) => (
          <SetupStepRow
            canManage={canManage}
            index={index}
            key={step.id}
            onSelectStep={onSelectStep}
            state={state}
            step={step}
          />
        ))}
      </ul>
    </section>
  )
}

function SetupStepRow({
  step,
  index,
  state,
  canManage,
  onSelectStep,
}: {
  step: SetupStep
  index: number
  state: SetupState
  canManage: boolean
  onSelectStep?: (step: "channel" | "knowledge") => void
}) {
  const copy = stepCopy(step, state)
  const action = stepAction(step, canManage, onSelectStep)

  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:gap-3">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <StepMarker index={index} status={step.status} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p
              className={cn(
                "text-sm font-medium",
                step.status === "done" && "text-muted-foreground"
              )}
            >
              {copy.title}
            </p>
            {step.optional && step.status !== "done" ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                {t("setup.optional")}
              </span>
            ) : null}
          </div>
          <p className="max-w-prose text-sm text-pretty text-muted-foreground">
            {copy.body}
          </p>
          {!canManage &&
          step.id !== "organization" &&
          step.status !== "done" ? (
            <p className="max-w-prose text-xs text-pretty text-muted-foreground">
              {t("setup.adminHint")}
            </p>
          ) : null}
        </div>
      </div>
      {action ? <div className="pl-9 sm:shrink-0 sm:pl-0">{action}</div> : null}
    </li>
  )
}

function StepMarker({
  status,
  index,
}: {
  status: SetupStep["status"]
  index: number
}) {
  const done = status === "done"
  const pending = status === "pending"

  return (
    <span
      aria-hidden
      className={cn(
        "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-medium tabular-nums",
        done && "border-primary/25 bg-primary/10 text-primary",
        pending && "border-border bg-muted text-muted-foreground",
        status === "current" && "border-primary text-primary",
        status === "todo" && "border-border text-muted-foreground"
      )}
    >
      {done ? (
        <HugeiconsIcon icon={Tick02Icon} size={13} strokeWidth={2} />
      ) : pending ? (
        <HugeiconsIcon
          className="animate-spin motion-reduce:animate-none"
          icon={Loading03Icon}
          size={13}
          strokeWidth={1.8}
        />
      ) : (
        index + 1
      )}
    </span>
  )
}

function stepCopy(step: SetupStep, state: SetupState) {
  switch (step.id) {
    case "organization":
      return {
        title: t("setup.steps.organization.title"),
        body: t("setup.steps.organization.done"),
      }
    case "channel":
      if (step.status === "done") {
        return {
          title: t("setup.steps.channel.title"),
          body: t("setup.steps.channel.done", {
            name: state.channelName ?? "WhatsApp",
          }),
        }
      }
      return {
        title: t("setup.steps.channel.title"),
        body:
          step.status === "pending"
            ? t("setup.steps.channel.pending")
            : t("setup.steps.channel.todo"),
      }
    case "knowledge":
      if (step.status === "done") {
        return {
          title: t("setup.steps.knowledge.title"),
          body: t("setup.steps.knowledge.done", {
            count: String(state.knowledgeReadyCount),
          }),
        }
      }
      return {
        title: t("setup.steps.knowledge.title"),
        body:
          step.status === "pending"
            ? t("setup.steps.knowledge.indexing")
            : t("setup.steps.knowledge.todo"),
      }
  }
}

function stepAction(
  step: SetupStep,
  canManage: boolean,
  onSelectStep?: (step: "channel" | "knowledge") => void
) {
  if (!canManage || step.status === "done") return null

  const label =
    step.id === "channel"
      ? step.status === "pending"
        ? t("setup.actions.finish")
        : t("setup.actions.connect")
      : t("setup.actions.add")
  const variant =
    step.id === "channel" && step.status !== "pending" ? "default" : "outline"

  if (
    step.id !== "channel" &&
    !(step.id === "knowledge" && step.status === "todo")
  ) {
    return null
  }

  const target = step.id === "channel" ? "channel" : "knowledge"

  // Inside the setup flow the step opens in place; from the Support Inbox the
  // same button sends the operator into that flow instead of to settings.
  if (onSelectStep) {
    return (
      <Button
        onClick={() => onSelectStep(target)}
        size="sm"
        type="button"
        variant={variant}
      >
        {label}
      </Button>
    )
  }

  return (
    <Button asChild size="sm" variant={variant}>
      <Link to="/setup">{label}</Link>
    </Button>
  )
}
