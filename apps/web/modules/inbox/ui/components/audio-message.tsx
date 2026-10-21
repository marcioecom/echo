"use client"

import type { InboxTimelineMessage } from "../../types"

import {
  AlertCircleIcon,
  AudioWaveformIcon,
  Loading03Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "@workspace/ui/lib/utils"

import { t } from "@/lib/i18n"

import { useMessageMediaUrl } from "../../hooks/use-message-media-url"
import { AudioPlayer } from "./audio-player"
import { AudioTranscript } from "./audio-transcript"

export function AudioMessage({
  conversationId,
  message,
  senderName,
  inverted = false,
}: {
  conversationId: string
  message: InboxTimelineMessage
  senderName: string
  inverted?: boolean
}) {
  const { url, expiresAt, isLoading, error, isUnavailable, load } =
    useMessageMediaUrl({
      conversationId,
      messageId: message.id,
    })
  const media = message.media

  const preparing = media?.downloadStatus === "pending"
  const downloadFailed = media?.downloadStatus === "failed"
  const transcribing =
    media?.downloadStatus !== "pending" &&
    !message.body &&
    (media?.transcriptStatus === "pending" ||
      media?.transcriptStatus === "transcribing")

  return (
    <div className="w-full min-w-0 space-y-2">
      {downloadFailed || isUnavailable ? (
        <AudioStatus
          icon={AlertCircleIcon}
          inverted={inverted}
          label={t("inbox.audio.unavailable")}
        />
      ) : error ? (
        <div className="flex items-center justify-between gap-3">
          <AudioStatus
            icon={AlertCircleIcon}
            inverted={inverted}
            label={t("inbox.audio.unavailable")}
          />
          <button
            className={cn(
              "shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
              inverted
                ? "text-primary-foreground hover:bg-primary-foreground/15 focus-visible:ring-primary-foreground/60"
                : "text-foreground hover:bg-accent focus-visible:ring-ring/40"
            )}
            onClick={load}
            type="button"
          >
            {t("inbox.retry")}
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <AudioPlayer
            durationMs={media?.durationMs ?? null}
            expiresAt={expiresAt}
            inverted={inverted}
            isBusy={preparing || isLoading}
            onSourceRequired={load}
            senderName={senderName}
            src={url}
          />
          {preparing ? (
            <AudioStatus
              inverted={inverted}
              label={t("inbox.audio.preparing")}
              loading
            />
          ) : null}
        </div>
      )}

      {message.body ? (
        <AudioTranscript inverted={inverted} text={message.body} />
      ) : transcribing ? (
        <AudioStatus
          inverted={inverted}
          label={t("inbox.audio.transcribing")}
          loading
        />
      ) : media?.transcriptStatus === "failed" ? (
        <AudioStatus
          icon={AlertCircleIcon}
          inverted={inverted}
          label={t("inbox.audio.transcriptionFailed")}
        />
      ) : null}
    </div>
  )
}

function AudioStatus({
  icon = AudioWaveformIcon,
  label,
  loading = false,
  inverted = false,
}: {
  icon?: typeof AudioWaveformIcon
  label: string
  loading?: boolean
  inverted?: boolean
}) {
  return (
    <p
      className={cn(
        "flex items-center gap-2 text-xs",
        inverted ? "text-primary-foreground" : "text-muted-foreground"
      )}
      role={loading ? "status" : undefined}
    >
      <HugeiconsIcon
        aria-hidden="true"
        className={cn(
          "shrink-0",
          loading && "animate-spin motion-reduce:animate-none"
        )}
        icon={loading ? Loading03Icon : icon}
        size={14}
        strokeWidth={1.8}
      />
      <span>{label}</span>
    </p>
  )
}
