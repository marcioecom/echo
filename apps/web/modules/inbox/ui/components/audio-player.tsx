"use client"

import { Loading03Icon, PauseIcon, PlayIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "@workspace/ui/lib/utils"
import { useCallback, useRef, useState } from "react"

import { t } from "@/lib/i18n"

import { useAudioPlayback } from "../../hooks/use-audio-playback"

const THUMB_SIZE = 10

export function AudioPlayer({
  src,
  expiresAt,
  durationMs,
  isBusy,
  inverted,
  senderName,
  onSourceRequired,
}: {
  src: string | null
  expiresAt: string | null
  durationMs: number | null
  isBusy: boolean
  inverted: boolean
  senderName: string
  onSourceRequired: () => void
}) {
  const {
    audioRef,
    audioEvents,
    currentTime,
    duration,
    isPlaying,
    rate,
    toggle,
    seek,
    cycleRate,
  } = useAudioPlayback({ src, expiresAt, durationMs, onSourceRequired })
  const trackRef = useRef<HTMLDivElement>(null)
  const [isScrubbing, setIsScrubbing] = useState(false)

  const ratio = duration > 0 ? Math.min(1, currentTime / duration) : 0
  const seeking = duration > 0
  const step = duration > 30 ? 5 : 1

  const seekToPointer = useCallback(
    (clientX: number) => {
      const track = trackRef.current
      if (!track || duration <= 0) return
      const rect = track.getBoundingClientRect()
      if (rect.width <= 0) return
      const next = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
      seek(next * duration)
    },
    [duration, seek]
  )

  return (
    <>
      <div className="flex w-full min-w-0 items-center gap-2.5">
        <button
          aria-busy={isBusy}
          aria-label={
            isBusy
              ? t("inbox.audio.preparing")
              : isPlaying
                ? t("inbox.audio.pauseLabel", { sender: senderName })
                : t("inbox.audio.playLabel", { sender: senderName })
          }
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed",
            inverted
              ? "bg-primary-foreground text-primary hover:bg-primary-foreground/85 focus-visible:ring-primary-foreground/60"
              : "bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring/40"
          )}
          disabled={isBusy}
          onClick={toggle}
          type="button"
        >
          <HugeiconsIcon
            aria-hidden="true"
            className={cn(
              isBusy && "animate-spin motion-reduce:animate-none",
              !isBusy && !isPlaying && "translate-x-px"
            )}
            icon={isBusy ? Loading03Icon : isPlaying ? PauseIcon : PlayIcon}
            size={15}
            strokeWidth={1.8}
          />
        </button>

        <div
          ref={trackRef}
          aria-disabled={!seeking}
          aria-label={t("inbox.audio.seekLabel")}
          aria-valuemax={Math.round(duration)}
          aria-valuemin={0}
          aria-valuenow={Math.round(currentTime)}
          aria-valuetext={t("inbox.audio.seekValue", {
            current: formatTime(currentTime),
            duration: formatTime(duration),
          })}
          className={cn(
            "group/seek relative flex h-7 min-w-14 flex-1 touch-none items-center rounded-full focus-visible:outline-none",
            seeking ? "cursor-pointer" : "cursor-default"
          )}
          onKeyDown={(event) => {
            if (!seeking) return
            if (event.key === "ArrowRight" || event.key === "ArrowUp") {
              event.preventDefault()
              seek(currentTime + step)
            } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
              event.preventDefault()
              seek(currentTime - step)
            } else if (event.key === "Home") {
              event.preventDefault()
              seek(0)
            } else if (event.key === "End") {
              event.preventDefault()
              seek(duration)
            }
          }}
          onPointerCancel={() => setIsScrubbing(false)}
          onPointerDown={(event) => {
            if (event.button !== 0 || !seeking) return
            event.preventDefault()
            event.currentTarget.focus()
            event.currentTarget.setPointerCapture(event.pointerId)
            setIsScrubbing(true)
            seekToPointer(event.clientX)
          }}
          onPointerMove={(event) => {
            if (!isScrubbing) return
            seekToPointer(event.clientX)
          }}
          onPointerUp={(event) => {
            if (!isScrubbing) return
            setIsScrubbing(false)
            event.currentTarget.releasePointerCapture(event.pointerId)
          }}
          role="slider"
          tabIndex={seeking ? 0 : -1}
        >
          <div
            aria-hidden="true"
            className={cn(
              "h-1.5 w-full overflow-hidden rounded-full",
              inverted
                ? "bg-primary-foreground/30 group-focus-visible/seek:ring-2 group-focus-visible/seek:ring-primary-foreground group-focus-visible/seek:ring-offset-2 group-focus-visible/seek:ring-offset-primary"
                : "bg-foreground/10 group-focus-visible/seek:ring-2 group-focus-visible/seek:ring-ring group-focus-visible/seek:ring-offset-2 group-focus-visible/seek:ring-offset-background"
            )}
          >
            <div
              className={cn(
                "h-full w-full origin-left rounded-full",
                isScrubbing
                  ? "transition-none"
                  : "transition-transform duration-150 ease-out motion-reduce:transition-none",
                inverted ? "bg-primary-foreground" : "bg-foreground/80"
              )}
              style={{ transform: `scaleX(${ratio})` }}
            />
          </div>
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform duration-150 ease-out motion-reduce:transition-none",
              inverted ? "bg-primary-foreground" : "bg-foreground",
              isScrubbing ? "scale-110" : "scale-100"
            )}
            style={{
              left: `calc(${ratio * 100}% + ${(0.5 - ratio) * THUMB_SIZE}px)`,
            }}
          />
        </div>

        <span
          className={cn(
            "shrink-0 text-[11px] leading-none font-medium whitespace-nowrap tabular-nums",
            inverted ? "text-primary-foreground" : "text-foreground",
            duration <= 0 && "hidden"
          )}
        >
          {formatTime(currentTime)}
          <span className={cn(!inverted && "text-muted-foreground")}>
            {" / "}
            {formatTime(duration)}
          </span>
        </span>

        <button
          aria-label={t("inbox.audio.speedLabel", {
            rate: formatRate(rate),
          })}
          className={cn(
            "shrink-0 rounded-md px-1 py-0.5 text-[11px] leading-none font-medium tabular-nums transition-colors focus-visible:ring-2 focus-visible:outline-none",
            inverted
              ? "text-primary-foreground hover:bg-primary-foreground/15 focus-visible:ring-primary-foreground/60"
              : "text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring/40"
          )}
          onClick={cycleRate}
          type="button"
        >
          {formatRate(rate)}
        </button>
      </div>

      <audio
        {...audioEvents}
        className="hidden"
        preload="metadata"
        ref={audioRef}
        src={src ?? undefined}
      />
    </>
  )
}

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(total / 60)
  return `${minutes}:${String(total % 60).padStart(2, "0")}`
}

function formatRate(rate: number): string {
  return `${rate}×`
}
