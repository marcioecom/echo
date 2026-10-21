"use client"

import type { SyntheticEvent } from "react"

import { useCallback, useEffect, useRef, useState } from "react"

const PLAYBACK_RATES = [1, 1.5, 2] as const

export type AudioPlaybackRate = (typeof PLAYBACK_RATES)[number]

// One voice message at a time: starting playback stops any other player.
const playingAudios = new Set<HTMLAudioElement>()

/**
 * Playback state for a single voice message. The signed media URL is fetched
 * lazily, so `play` asks the caller for a source when there is none (or when
 * the current one has expired) and starts playback as soon as it arrives.
 */
export function useAudioPlayback({
  src,
  expiresAt,
  durationMs,
  onSourceRequired,
}: {
  src: string | null
  expiresAt: string | null
  durationMs: number | null
  onSourceRequired: () => void
}) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const wantsPlayRef = useRef(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [metadataDuration, setMetadataDuration] = useState<number | null>(null)
  const [rate, setRate] = useState<AudioPlaybackRate>(1)

  const duration =
    metadataDuration && Number.isFinite(metadataDuration)
      ? metadataDuration
      : durationMs
        ? durationMs / 1000
        : 0

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !src || !wantsPlayRef.current) return
    wantsPlayRef.current = false
    void audio.play().catch(() => {
      // Autoplay can be blocked; the play control stays available.
    })
  }, [src])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    playingAudios.add(audio)
    return () => {
      playingAudios.delete(audio)
    }
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (audio) audio.playbackRate = rate
  }, [rate, src])

  const play = useCallback(() => {
    const audio = audioRef.current
    const sourceIsFresh =
      Boolean(src) && (!expiresAt || Date.parse(expiresAt) > Date.now())

    if (!audio || !sourceIsFresh) {
      wantsPlayRef.current = true
      onSourceRequired()
      return
    }

    void audio.play().catch(() => {
      // Playback can be refused; the play control stays available.
    })
  }, [expiresAt, onSourceRequired, src])

  const toggle = useCallback(() => {
    if (isPlaying) {
      audioRef.current?.pause()
      return
    }
    play()
  }, [isPlaying, play])

  const seek = useCallback(
    (seconds: number) => {
      const audio = audioRef.current
      if (!audio || duration <= 0) return
      const next = Math.min(Math.max(seconds, 0), duration)
      audio.currentTime = next
      setCurrentTime(next)
    },
    [duration]
  )

  const cycleRate = useCallback(() => {
    setRate((current) => {
      const index = PLAYBACK_RATES.indexOf(current)
      return PLAYBACK_RATES[(index + 1) % PLAYBACK_RATES.length] ?? 1
    })
  }, [])

  const audioEvents = {
    onLoadedMetadata: (event: SyntheticEvent<HTMLAudioElement>) => {
      const value = event.currentTarget.duration
      setMetadataDuration(Number.isFinite(value) ? value : null)
    },
    onTimeUpdate: (event: SyntheticEvent<HTMLAudioElement>) => {
      setCurrentTime(event.currentTarget.currentTime)
    },
    onPlay: (event: SyntheticEvent<HTMLAudioElement>) => {
      playingAudios.forEach((audio) => {
        if (audio !== event.currentTarget) audio.pause()
      })
      setIsPlaying(true)
    },
    onPause: () => setIsPlaying(false),
    onEnded: (event: SyntheticEvent<HTMLAudioElement>) => {
      event.currentTarget.currentTime = 0
      setCurrentTime(0)
      setIsPlaying(false)
    },
  }

  return {
    audioRef,
    audioEvents,
    currentTime,
    duration,
    isPlaying,
    rate,
    toggle,
    seek,
    cycleRate,
  }
}
