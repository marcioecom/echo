"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { deleteChannel, updateChannel } from "./api"
import { channelQueryKeys } from "./use-channels"

export function useChannelActions(organizationId: string, channelId: string) {
  const queryClient = useQueryClient()

  function refresh() {
    return queryClient.invalidateQueries({
      queryKey: channelQueryKeys.list(organizationId),
    })
  }

  const removeMutation = useMutation({
    mutationFn: () => deleteChannel(channelId),
    onSettled: refresh,
  })
  const activateMutation = useMutation({
    mutationFn: () => updateChannel(channelId, { status: "active" }),
    onSettled: refresh,
  })

  return { removeMutation, activateMutation }
}
