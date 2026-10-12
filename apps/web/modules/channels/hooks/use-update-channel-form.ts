"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import type { ChannelConnection } from "../types"
import { updateChannel } from "./api"
import { channelQueryKeys } from "./use-channels"

const updateChannelSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "channels.validation.displayName")
    .max(120),
  inboxId: z.string().trim().max(64),
})

export type UpdateChannelValues = z.infer<typeof updateChannelSchema>

export function useUpdateChannelForm(organizationId: string) {
  const queryClient = useQueryClient()
  const [editingId, setEditingId] = useState<string | null>(null)
  const form = useForm<UpdateChannelValues>({
    resolver: zodResolver(updateChannelSchema),
    defaultValues: { displayName: "", inboxId: "" },
  })
  const mutation = useMutation({
    mutationFn: (values: UpdateChannelValues) => {
      if (!editingId) throw new Error("Choose a channel")
      return updateChannel(editingId, {
        displayName: values.displayName.trim(),
        inboxId: values.inboxId.trim() ? values.inboxId.trim() : null,
      })
    },
    onSuccess: () => setEditingId(null),
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: channelQueryKeys.list(organizationId),
      }),
  })

  function edit(channel: ChannelConnection) {
    mutation.reset()
    setEditingId(channel.id)
    form.reset({
      displayName: channel.displayName ?? channel.name,
      inboxId: channel.inboxId ?? "",
    })
  }

  function cancel() {
    setEditingId(null)
    mutation.reset()
  }

  return { form, mutation, editingId, edit, cancel }
}
