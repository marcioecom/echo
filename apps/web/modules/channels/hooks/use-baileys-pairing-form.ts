"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import type { ChannelsCopy } from "../i18n"
import { createBaileysChannel, requestPairingCode } from "./api"
import { channelQueryKeys } from "./use-channels"

export type BaileysChannelValues = {
  displayName: string
  inboxId: string
}

export type PairingCodeValues = {
  phoneNumber: string
}

function baileysChannelSchema(copy: ChannelsCopy) {
  return z.object({
    displayName: z.string().trim().min(1, copy.validation.displayName).max(120),
    inboxId: z.string().trim().max(64),
  })
}

function pairingCodeSchema(copy: ChannelsCopy) {
  return z.object({
    phoneNumber: z
      .string()
      .trim()
      .regex(/^\+[1-9]\d{1,14}$/, copy.validation.address),
  })
}

export function useBaileysPairingForm(
  organizationId: string,
  copy: ChannelsCopy
) {
  const queryClient = useQueryClient()
  const channelSchema = useMemo(() => baileysChannelSchema(copy), [copy])
  const codeSchema = useMemo(() => pairingCodeSchema(copy), [copy])
  const form = useForm<BaileysChannelValues>({
    resolver: zodResolver(channelSchema),
    defaultValues: { displayName: "", inboxId: "" },
  })
  const pairingForm = useForm<PairingCodeValues>({
    resolver: zodResolver(codeSchema),
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

  function reset() {
    form.reset()
    pairingForm.reset()
    mutation.reset()
    pairingMutation.reset()
  }

  return { form, mutation, pairingForm, pairingMutation, reset }
}
