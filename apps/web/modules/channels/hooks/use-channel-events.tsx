"use client"

import { useQueryClient } from "@tanstack/react-query"
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"

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
  qrByChannelId: Record<string, string>
  pairingCodeByChannelId: Record<string, string>
}

export function useChannelEvents(organizationId: string): ChannelLiveEvents {
  const queryClient = useQueryClient()
  const [connected, setConnected] = useState(false)
  const [eventsOrganizationId, setEventsOrganizationId] = useState(organizationId)
  const [qrByChannelId, setQrByChannelId] = useState<
    ChannelLiveEvents["qrByChannelId"]
  >({})
  const [pairingCodeByChannelId, setPairingCodeByChannelId] = useState<
    ChannelLiveEvents["pairingCodeByChannelId"]
  >({})

  useEffect(() => {
    setEventsOrganizationId(organizationId)
    setConnected(false)
    setQrByChannelId({})
    setPairingCodeByChannelId({})

    let socket: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let reconnectAttempt = 0
    let stopped = false

    function connect() {
      if (stopped || document.visibilityState === "hidden") return

      socket = new WebSocket(getChannelEventsUrl())
      socket.addEventListener("open", () => {
        if (stopped) return
        const shouldRefresh = reconnectAttempt > 0
        reconnectAttempt = 0
        setConnected(true)
        if (!shouldRefresh) return
        queryClient.invalidateQueries({
          queryKey: channelQueryKeys.list(organizationId),
        })
      })
      socket.addEventListener("message", (message) => {
        if (stopped) return
        let event: unknown
        try {
          event = JSON.parse(String(message.data))
        } catch {
          return
        }
        const status = channelStatusChangedEventSchema.safeParse(event)
        if (status.success) {
          const id = status.data.channelConnectionId
          setQrByChannelId((current) => dropChannelEntry(current, id))
          setPairingCodeByChannelId((current) => dropChannelEntry(current, id))
          queryClient.invalidateQueries({
            queryKey: channelQueryKeys.list(organizationId),
          })
          return
        }
        const qrEvent = channelQrEventSchema.safeParse(event)
        if (qrEvent.success) {
          const id = qrEvent.data.channelConnectionId
          setQrByChannelId((current) => ({
            ...current,
            [id]: qrEvent.data.qr,
          }))
          return
        }
        const codeEvent = channelPairingCodeEventSchema.safeParse(event)
        if (codeEvent.success) {
          const id = codeEvent.data.channelConnectionId
          setPairingCodeByChannelId((current) => ({
            ...current,
            [id]: codeEvent.data.pairingCode,
          }))
        }
      })
      socket.addEventListener("close", () => {
        if (stopped) return
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
      queryClient.invalidateQueries({
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

  return eventsOrganizationId === organizationId
    ? { connected, qrByChannelId, pairingCodeByChannelId }
    : { connected: false, qrByChannelId: {}, pairingCodeByChannelId: {} }
}

function dropChannelEntry(
  map: Record<string, string>,
  channelConnectionId: string
): Record<string, string> {
  if (!(channelConnectionId in map)) return map
  const next = { ...map }
  delete next[channelConnectionId]
  return next
}

const ChannelLiveContext = createContext<ChannelLiveEvents | null>(null)

export function ChannelLiveProvider({
  organizationId,
  children,
}: {
  organizationId: string
  children: ReactNode
}) {
  const live = useChannelEvents(organizationId)
  return (
    <ChannelLiveContext.Provider value={live}>
      {children}
    </ChannelLiveContext.Provider>
  )
}

export function useChannelLive(): ChannelLiveEvents {
  const live = useContext(ChannelLiveContext)
  if (!live) {
    throw new Error("useChannelLive must be used inside ChannelLiveProvider")
  }
  return live
}
