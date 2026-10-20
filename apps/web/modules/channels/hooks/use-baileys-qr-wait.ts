"use client"

import type { ChannelConnection } from "../types"

import { useEffect, useState } from "react"

import { useChannelLive } from "./use-channel-events"
import { useChannels } from "./use-channels"

const QR_WAIT_TIMEOUT_MS = 45_000

const terminalStates = new Set([
  "disconnected",
  "logged_out",
  "banned_suspected",
])

export type BaileysQrWait =
  | { status: "waiting" }
  | { status: "ready"; qr: string }
  | { status: "failed"; reason: string }

export function useBaileysQrWait(input: {
  organizationId: string
  channelId: string | null
}): BaileysQrWait {
  const live = useChannelLive()
  const channels = useChannels(input.organizationId)
  const [timedOut, setTimedOut] = useState(false)

  const qr = input.channelId
    ? (live.qrByChannelId[input.channelId] ?? null)
    : null

  const channel = findChannel(channels.data?.items, input.channelId)
  const sessionFailed = isSessionFailed(channel)

  useEffect(() => {
    setTimedOut(false)
    if (!input.channelId || qr || sessionFailed) return
    const timer = setTimeout(() => setTimedOut(true), QR_WAIT_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [input.channelId, qr, sessionFailed])

  if (!input.channelId) return { status: "waiting" }
  if (qr) return { status: "ready", qr }
  if (sessionFailed) {
    return {
      status: "failed",
      reason: channel?.session?.lastError ?? "pairing_failed",
    }
  }
  if (timedOut) return { status: "failed", reason: "qr_timeout" }
  return { status: "waiting" }
}

function findChannel(
  items: ChannelConnection[] | undefined,
  channelId: string | null
) {
  if (!items || !channelId) return null
  return items.find((channel) => channel.id === channelId) ?? null
}

function isSessionFailed(channel: ChannelConnection | null) {
  const state = channel?.session?.state
  if (!state) return false
  return terminalStates.has(state)
}
