"use client"

import type { InboxConversationDetail } from "../types"

import { useEffect, useRef } from "react"

import { track } from "@/lib/analytics"

export function useConversationOpened(
  organizationId: string,
  conversation: InboxConversationDetail["conversation"] | undefined
) {
  const conversationId = conversation?.id ?? null
  const channelType = conversation?.contact.channelType ?? null
  const lastOpenedId = useRef<string | null>(null)

  useEffect(() => {
    if (!conversationId || !channelType) return
    if (lastOpenedId.current === conversationId) return

    lastOpenedId.current = conversationId
    void track("conversation_opened", { organizationId, channelType })
  }, [channelType, conversationId, organizationId])
}
