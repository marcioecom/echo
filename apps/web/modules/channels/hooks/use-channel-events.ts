"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"

import {
  channelPairingCodeEventSchema,
  channelQrEventSchema,
  channelStatusChangedEventSchema,
} from "../types"
import { getChannelEventsUrl } from "./api"
import { channelQueryKeys } from "./use-channels"

const initialReconnectDelay = 1_000
const maximumReconnectDelay = 30_000

export interface ChannelLiveEvents {
  connected: boolean
  qr: { channelConnectionId: string; qr: string } | null
  pairingCode: {
    channelConnectionId: string
    pairingCode: string
  } | null
}

export function useChannelEvents(organizationId: string): ChannelLiveEvents {
  const queryClient = useQueryClient()
  const [connected, setConnected] = useState(false)
  const [qr, setQr] = useState<ChannelLiveEvents["qr"]>(null)
  const [pairingCode, setPairingCode] =
    useState<ChannelLiveEvents["pairingCode"]>(null)

  useEffect(() => {
    let socket: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let reconnectAttempt = 0
    let stopped = false

    function connect() {
      if (stopped || document.visibilityState === "hidden") return

      socket = new WebSocket(getChannelEventsUrl())
      socket.addEventListener("open", () => {
        const shouldRefresh = reconnectAttempt > 0
        reconnectAttempt = 0
        setConnected(true)
        if (!shouldRefresh) return
        void queryClient.invalidateQueries({
          queryKey: channelQueryKeys.list(organizationId),
        })
      })
      socket.addEventListener("message", (message) => {
        let event: unknown
        try {
          event = JSON.parse(String(message.data))
        } catch {
          return
        }
        const status = channelStatusChangedEventSchema.safeParse(event)
        if (status.success) {
          setQr((current) =>
            current?.channelConnectionId === status.data.channelConnectionId
              ? null
              : current
          )
          setPairingCode((current) =>
            current?.channelConnectionId === status.data.channelConnectionId
              ? null
              : current
          )
          void queryClient.invalidateQueries({
            queryKey: channelQueryKeys.list(organizationId),
          })
          return
        }
        const qrEvent = channelQrEventSchema.safeParse(event)
        if (qrEvent.success) {
          setQr({
            channelConnectionId: qrEvent.data.channelConnectionId,
            qr: qrEvent.data.qr,
          })
          return
        }
        const codeEvent = channelPairingCodeEventSchema.safeParse(event)
        if (codeEvent.success) {
          setPairingCode({
            channelConnectionId: codeEvent.data.channelConnectionId,
            pairingCode: codeEvent.data.pairingCode,
          })
        }
      })
      socket.addEventListener("close", () => {
        socket = null
        setConnected(false)
        if (stopped || document.visibilityState === "hidden") return
        const delay = Math.min(
          initialReconnectDelay * 2 ** reconnectAttempt,
          maximumReconnectDelay
        )
        reconnectAttempt += 1
        reconnectTimer = setTimeout(connect, delay)
      })
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        if (reconnectTimer) clearTimeout(reconnectTimer)
        reconnectTimer = null
        socket?.close()
        return
      }
      void queryClient.invalidateQueries({
        queryKey: channelQueryKeys.list(organizationId),
      })
      if (!socket) connect()
    }

    connect()
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      stopped = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      socket?.close()
    }
  }, [organizationId, queryClient])

  return { connected, qr, pairingCode }
}
