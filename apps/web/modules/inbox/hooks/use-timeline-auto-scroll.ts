"use client"

import { useEffect, useRef } from "react"

export function useTimelineAutoScroll(
  conversationId: string | null,
  lastMessageId: string | null
) {
  const timelineRef = useRef<HTMLDivElement>(null)
  const previousConversationId = useRef<string | null>(null)
  const previousLastMessageId = useRef<string | null>(null)

  useEffect(() => {
    if (!timelineRef.current || !conversationId) return

    const conversationChanged = previousConversationId.current !== conversationId
    const messageArrived =
      !conversationChanged &&
      previousLastMessageId.current !== null &&
      previousLastMessageId.current !== lastMessageId

    if (conversationChanged || messageArrived) {
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches
      timelineRef.current.scrollTo({
        top: timelineRef.current.scrollHeight,
        behavior: messageArrived && !reducedMotion ? "smooth" : "auto",
      })
    }

    previousConversationId.current = conversationId
    previousLastMessageId.current = lastMessageId
  }, [conversationId, lastMessageId])

  return timelineRef
}
