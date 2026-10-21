"use client"

import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Copy01Icon,
  SparklesIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "@workspace/ui/lib/utils"
import { useEffect, useId, useRef, useState } from "react"

import { t } from "@/lib/i18n"

export function AudioTranscript({
  text,
  inverted,
}: {
  text: string
  inverted: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [isClamped, setIsClamped] = useState(false)
  const [copied, setCopied] = useState(false)
  const textRef = useRef<HTMLParagraphElement>(null)
  const copyTimerRef = useRef<number | null>(null)
  const transcriptId = useId()

  useEffect(() => {
    if (expanded) return
    const element = textRef.current
    if (!element) return

    const measure = () => {
      setIsClamped(element.scrollHeight - element.clientHeight > 1)
    }
    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [text, expanded])

  useEffect(
    () => () => {
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current)
    },
    []
  )

  const copy = () => {
    if (!navigator.clipboard) return
    void navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true)
        if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current)
        copyTimerRef.current = window.setTimeout(() => setCopied(false), 1800)
      })
      .catch(() => {
        // Clipboard access can be denied; the transcript stays selectable.
      })
  }

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2">
        <p
          className={cn(
            "flex items-center gap-1.5 text-[11px] font-medium",
            inverted ? "text-primary-foreground" : "text-muted-foreground"
          )}
        >
          <HugeiconsIcon
            aria-hidden="true"
            icon={SparklesIcon}
            size={12}
            strokeWidth={1.8}
          />
          {t("inbox.audio.transcriptAutomatic")}
        </p>
        <button
          aria-label={
            copied
              ? t("inbox.audio.transcriptCopied")
              : t("inbox.audio.copyTranscript")
          }
          className={cn(
            "-mr-1 inline-flex size-6 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none",
            inverted
              ? "text-primary-foreground hover:bg-primary-foreground/15 focus-visible:ring-primary-foreground/60"
              : "text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring/40"
          )}
          onClick={copy}
          type="button"
        >
          <HugeiconsIcon
            aria-hidden="true"
            icon={copied ? Tick02Icon : Copy01Icon}
            size={12}
            strokeWidth={1.8}
          />
        </button>
      </div>

      <span aria-live="polite" className="sr-only">
        {copied ? t("inbox.audio.transcriptCopied") : ""}
      </span>

      <p
        className={cn(
          "mt-1 text-sm leading-relaxed text-pretty whitespace-pre-wrap",
          !expanded && "line-clamp-4",
          inverted ? "text-primary-foreground" : "text-foreground"
        )}
        id={transcriptId}
        ref={textRef}
      >
        {text}
      </p>

      {isClamped ? (
        <button
          aria-controls={transcriptId}
          aria-expanded={expanded}
          className={cn(
            "mt-1 inline-flex items-center gap-1 rounded-md text-[11px] font-medium underline-offset-2 transition-colors hover:underline focus-visible:ring-2 focus-visible:outline-none",
            inverted
              ? "text-primary-foreground focus-visible:ring-primary-foreground/60"
              : "text-muted-foreground hover:text-foreground focus-visible:ring-ring/40"
          )}
          onClick={() => setExpanded((value) => !value)}
          type="button"
        >
          <HugeiconsIcon
            aria-hidden="true"
            icon={expanded ? ArrowUp01Icon : ArrowDown01Icon}
            size={12}
            strokeWidth={1.8}
          />
          {expanded
            ? t("inbox.audio.hideTranscript")
            : t("inbox.audio.showTranscript")}
        </button>
      ) : null}
    </div>
  )
}
