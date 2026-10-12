"use client"

import { useQuery } from "@tanstack/react-query"

import { listChannels } from "./api"

export const channelQueryKeys = {
  list: (organizationId: string) => ["channels", organizationId] as const,
}

export function useChannels(organizationId: string) {
  return useQuery({
    queryKey: channelQueryKeys.list(organizationId),
    queryFn: listChannels,
  })
}
