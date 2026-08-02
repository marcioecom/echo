"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"

import { supportConversationUpdatedEventSchema } from "../types"
import { getInboxWebSocketUrl } from "./api"
import { inboxQueryKeys } from "./use-inbox-conversations"

const initialReconnectDelay = 1_000
const maximumReconnectDelay = 30_000

export function useInboxEvents(organizationId: string): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    let socket: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let reconnectAttempt = 0
    let stopped = false

    function connect() {
      if (stopped || document.visibilityState === "hidden") return

      socket = new WebSocket(getInboxWebSocketUrl())
      socket.addEventListener("open", () => {
        reconnectAttempt = 0
      })
      socket.addEventListener("message", (message) => {
        let event: unknown
        try {
          event = JSON.parse(String(message.data))
        } catch {
          return
        }

        const parsed = supportConversationUpdatedEventSchema.safeParse(event)
        if (!parsed.success) return

        void queryClient.invalidateQueries({
          queryKey: inboxQueryKeys.lists(organizationId),
        })
        void queryClient.invalidateQueries({
          queryKey: inboxQueryKeys.detail(
            organizationId,
            parsed.data.conversationId
          ),
        })
      })
      socket.addEventListener("close", () => {
        socket = null
        if (stopped) return
        if (document.visibilityState === "hidden") return
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
}
