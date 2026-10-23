"use client"

import type { InboxConversationPage } from "@/modules/inbox/types"

import { useQuery } from "@tanstack/react-query"

import { inboxApiRequest } from "@/modules/inbox/hooks/api"

import { describeFirstConversation } from "../state"

const POLL_INTERVAL_MS = 3_000

/**
 * Watches for the first real conversation while the Support Inbox is quiet.
 * Keeps polling after the contact writes until Echo answers, so the setup screen
 * can go from "message arrived" to "it works" on its own.
 */
export function useFirstConversation(organizationId: string, enabled: boolean) {
  const query = useQuery({
    queryKey: ["setup", "first-conversation", organizationId] as const,
    queryFn: () =>
      inboxApiRequest<InboxConversationPage>(
        "/v1/support-conversations?status=all&limit=1"
      ),
    enabled,
    refetchInterval: (current) => {
      const conversation = current.state.data?.items[0] ?? null
      if (
        conversation &&
        describeFirstConversation(conversation).echoAnswered
      ) {
        return false
      }
      return POLL_INTERVAL_MS
    },
  })

  const conversation = query.data?.items[0] ?? null

  return { ...describeFirstConversation(conversation), conversation, query }
}
