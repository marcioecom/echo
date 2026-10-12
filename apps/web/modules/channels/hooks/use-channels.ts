"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { deleteChannel, listChannels, updateChannel } from "./api"

export const channelQueryKeys = {
  list: (organizationId: string) => ["channels", organizationId] as const,
}

export function useChannels(organizationId: string) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: channelQueryKeys.list(organizationId),
    queryFn: listChannels,
  })

  function refresh() {
    return queryClient.invalidateQueries({
      queryKey: channelQueryKeys.list(organizationId),
    })
  }

  const removeMutation = useMutation({
    mutationFn: deleteChannel,
    onSettled: refresh,
  })
  const activateMutation = useMutation({
    mutationFn: (channelConnectionId: string) =>
      updateChannel(channelConnectionId, { status: "active" }),
    onSettled: refresh,
  })

  return { query, removeMutation, activateMutation }
}
