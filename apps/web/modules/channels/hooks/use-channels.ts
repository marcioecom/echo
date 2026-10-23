"use client"

import type { ChannelConnection } from "../types"

import { useQuery } from "@tanstack/react-query"

import { listChannels } from "./api"

export const channelQueryKeys = {
  list: (organizationId: string) => ["channels", organizationId] as const,
}

export function useChannels(organizationId: string) {
  return useQuery({
    queryKey: channelQueryKeys.list(organizationId),
    queryFn: listChannels,
    // The live socket is the primary signal. This poll is a safety net. A missed
    // event must not leave the pairing screen stuck after the phone connects.
    refetchInterval: (query) =>
      query.state.data?.items.some((channel) => channel.status === "pending")
        ? 3_000
        : false,
  })
}

export function isChannelConnected(
  channel: ChannelConnection | null | undefined
): boolean {
  if (!channel) return false
  return channel.status === "active" || channel.session?.state === "connected"
}
