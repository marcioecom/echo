"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { createBaileysChannel, requestPairingCode } from "./api"
import { channelQueryKeys } from "./use-channels"

const baileysChannelSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "channels.validation.displayName")
    .max(120),
  inboxId: z.string().trim().max(64),
})

const pairingCodeSchema = z.object({
  phoneNumber: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{1,14}$/, "channels.validation.address"),
})

export type BaileysChannelValues = z.infer<typeof baileysChannelSchema>
export type PairingCodeValues = z.infer<typeof pairingCodeSchema>

export function useBaileysPairingForm(organizationId: string) {
  const queryClient = useQueryClient()
  const form = useForm<BaileysChannelValues>({
    resolver: zodResolver(baileysChannelSchema),
    defaultValues: { displayName: "", inboxId: "" },
  })
  const pairingForm = useForm<PairingCodeValues>({
    resolver: zodResolver(pairingCodeSchema),
    defaultValues: { phoneNumber: "" },
  })
  const mutation = useMutation({
    mutationFn: (values: BaileysChannelValues) =>
      createBaileysChannel({
        displayName: values.displayName.trim(),
        ...(values.inboxId.trim() ? { inboxId: values.inboxId.trim() } : {}),
      }),
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: channelQueryKeys.list(organizationId),
      }),
  })
  const pairingMutation = useMutation({
    mutationFn: (values: PairingCodeValues) => {
      const channelConnectionId = mutation.data?.channel.id
      if (!channelConnectionId) {
        return Promise.reject(new Error("missing channel"))
      }
      return requestPairingCode(channelConnectionId, values.phoneNumber.trim())
    },
  })

  return { form, mutation, pairingForm, pairingMutation }
}
