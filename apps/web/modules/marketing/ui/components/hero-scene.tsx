"use client"

import type { ChatLine } from "./conversation-thread"
import type { HeroPhase } from "@/modules/marketing/hooks/use-hero-sequence"

import {
  BookOpen01Icon,
  CheckIcon,
  PauseIcon,
  PlayIcon,
  ReplayIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import {
  reachedPhase,
  useHeroSequence,
} from "@/modules/marketing/hooks/use-hero-sequence"
import { useLanding } from "@/modules/marketing/i18n/landing-context"

import { ConversationThread } from "./conversation-thread"

type SweepHalf = "channel" | "knowledge"

const sweeps: Partial<
  Record<HeroPhase, { half: SweepHalf; reverse: boolean }>
> = {
  channelIn: { half: "channel", reverse: true },
  knowledgeIn: { half: "knowledge", reverse: true },
  knowledgeOut: { half: "knowledge", reverse: false },
  channelInTwo: { half: "channel", reverse: true },
  knowledgeInTwo: { half: "knowledge", reverse: true },
  knowledgeOutTwo: { half: "knowledge", reverse: false },
}

function statusKey(phase: HeroPhase) {
  if (reachedPhase(phase, "done")) return "done"
  if (reachedPhase(phase, "handoff")) return "handingOff"
  if (reachedPhase(phase, "noMatch")) return "noMatch"
  if (reachedPhase(phase, "questionTwo")) return "reading"
  if (reachedPhase(phase, "answerOne")) return "answered"
  if (reachedPhase(phase, "source")) return "answering"
  if (reachedPhase(phase, "channelIn")) return "reading"
  return "listening"
}

function nodeState(phase: HeroPhase) {
  if (reachedPhase(phase, "done")) return "done"
  if (reachedPhase(phase, "handoff")) return "handoff"
  if (reachedPhase(phase, "noMatch")) return "searching"
  if (reachedPhase(phase, "questionTwo")) return "reading"
  if (reachedPhase(phase, "source")) return "answering"
  if (reachedPhase(phase, "channelIn")) return "reading"
  return "idle"
}

export function HeroScene() {
  const { copy } = useLanding()
  const { stageRef, phase, mode, reducedMotion, toggle } = useHeroSequence()
  const { scene } = copy.hero
  const { conversation, handoff, knowledge } = scene

  const messages: ChatLine[] = []
  if (reachedPhase(phase, "questionOne")) {
    messages.push({ from: "customer", text: conversation.questionOne })
  }
  if (reachedPhase(phase, "answerOne")) {
    messages.push({
      from: "echo",
      text: conversation.answerOne,
      source: scene.documents[0]?.title,
    })
  }
  if (reachedPhase(phase, "questionTwo")) {
    messages.push({ from: "customer", text: conversation.questionTwo })
  }
  if (reachedPhase(phase, "handoff")) {
    messages.push({ from: "echo", text: conversation.answerTwo })
  }

  const sweep = sweeps[phase]
  const activeDocument = reachedPhase(phase, "source")
  const noMatch = reachedPhase(phase, "noMatch")
  const state = nodeState(phase)
  const status = scene.status[statusKey(phase)]
  const controlLabel =
    mode === "playing"
      ? scene.controls.pause
      : mode === "paused"
        ? scene.controls.play
        : scene.controls.replay
  const ControlIcon =
    mode === "playing" ? PauseIcon : mode === "paused" ? PlayIcon : ReplayIcon

  return (
    <div
      ref={stageRef}
      className="relative mx-auto mt-7 w-full max-w-4xl px-5 pb-2 sm:mt-5 sm:px-6"
    >
      <p className="sr-only">{scene.sr}</p>

      <div
        aria-hidden
        className="grid gap-y-0 lg:grid-cols-[minmax(15rem,22rem)_minmax(4rem,1fr)_minmax(17rem,22rem)] lg:items-center lg:gap-0"
      >
        <aside className="w-full max-w-[22rem] justify-self-center rounded-2xl border border-black/[0.08] bg-white lg:max-w-none lg:justify-self-stretch">
          <header className="flex items-center gap-2.5 border-b border-black/[0.06] px-4 py-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--echo-green-50)] text-[var(--echo-green-700)]">
              <HugeiconsIcon
                icon={BookOpen01Icon}
                size={14}
                strokeWidth={1.8}
              />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[12px] leading-4 font-medium text-neutral-900">
                {knowledge.title}
              </p>
              <p className="text-[10.5px] leading-4 text-neutral-500">
                {knowledge.meta}
              </p>
            </div>
          </header>

          <ul data-dimmed={noMatch ? "" : undefined}>
            {scene.documents.map((document, index) => {
              const active = index === 0 && activeDocument

              return (
                <li
                  key={document.title}
                  data-active={active ? "" : undefined}
                  className="hero-doc flex items-center gap-3 border-t border-black/[0.05] px-4 py-2.5 first:border-t-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] leading-4 font-medium text-neutral-800">
                      {document.title}
                    </p>
                    <p className="hidden text-[10.5px] leading-4 text-neutral-500 sm:block">
                      {document.body}
                    </p>
                  </div>
                  {active ? (
                    <span className="hero-doc-tag shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] leading-4 font-medium text-[var(--echo-green-700)]">
                      {knowledge.source}
                    </span>
                  ) : null}
                </li>
              )
            })}
          </ul>

          <p
            className="hero-note border-t border-black/[0.05] bg-neutral-50 px-4 py-2.5 text-[10.5px] leading-4 text-neutral-600"
            data-alert={noMatch ? "" : undefined}
          >
            {noMatch ? knowledge.noMatch : knowledge.footer}
          </p>
        </aside>

        <div className="hero-rail relative flex h-24 items-center justify-center self-stretch lg:h-auto lg:min-h-[19rem]">
          <span className="hero-rail-line" />
          {sweep ? (
            <span
              key={phase}
              data-half={sweep.half}
              data-reverse={sweep.reverse ? "" : undefined}
              className="hero-sweep"
            />
          ) : null}
          <div className="hero-node relative z-10" data-state={state}>
            {state === "reading" ||
            state === "answering" ||
            state === "searching" ||
            state === "handoff" ? (
              <span key={phase} className="hero-node-ring" />
            ) : null}
            <img
              src="/brand/echo-logo-mark.png"
              alt=""
              width={246}
              height={246}
              className="relative size-6 lg:size-7"
            />
            {state === "handoff" ? (
              <span className="hero-node-badge bg-[var(--echo-green-700)] text-white">
                {handoff.name.slice(0, 1)}
              </span>
            ) : null}
            {state === "done" ? (
              <span className="hero-node-badge bg-[var(--echo-green-600)] text-white">
                <HugeiconsIcon icon={CheckIcon} size={9} strokeWidth={2.6} />
              </span>
            ) : null}
          </div>
        </div>

        <div className="w-full justify-self-center lg:justify-self-stretch">
          <ConversationThread
            business={conversation.business}
            channel={conversation.channel}
            messages={messages}
            handoff={reachedPhase(phase, "handoff") ? handoff : null}
            variant="hero"
            messagesClassName="min-h-[18rem] px-4 pb-3 sm:min-h-0 sm:h-[17.5rem]"
            className="mx-auto lg:mx-0"
          />
        </div>
      </div>

      <div className="mx-auto mt-2 flex w-full items-center justify-between gap-4">
        <p className="flex items-center gap-2 text-[11.5px] leading-4 text-neutral-600">
          <span
            aria-hidden
            data-live={mode === "playing" ? "" : undefined}
            className="hero-status-dot"
          />
          {status}
        </p>

        {reducedMotion ? null : (
          <button
            type="button"
            onClick={toggle}
            className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white/70 px-2.5 py-1 text-[11px] leading-4 font-medium text-neutral-600 transition-colors outline-none hover:bg-white hover:text-neutral-900 focus-visible:ring-2 focus-visible:ring-[color:var(--echo-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
          >
            <HugeiconsIcon
              icon={ControlIcon}
              size={11}
              strokeWidth={2.2}
              aria-hidden
            />
            {controlLabel}
          </button>
        )}
      </div>
    </div>
  )
}
