"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import type { ChannelsCopy } from "../i18n"
import { createTwilioChannel } from "./api"
import { channelQueryKeys } from "./use-channels"

export type ConnectChannelValues = {
  displayName: string
  accountSid: string
  authToken: string
  address: string
  inboxId: string
}

function connectChannelSchema(copy: ChannelsCopy) {
  return z.object({
    displayName: z.string().trim().min(1, copy.validation.displayName).max(120),
    accountSid: z
      .string()
      .trim()
      .regex(/^AC[a-fA-F0-9]{32}$/, copy.validation.accountSid),
    authToken: z.string().trim().min(1, copy.validation.authToken),
    address: z
      .string()
      .trim()
      .superRefine((value, context) => {
        const normalized = value.replace(/[\s()-]/g, "")
        if (!/^\+[1-9]\d{1,14}$/.test(normalized)) {
          context.addIssue({
            code: "custom",
            message: copy.validation.address,
          })
        }
      }),
    inboxId: z.string().trim().max(64),
  })
}

export function useConnectChannelForm(
  organizationId: string,
  copy: ChannelsCopy
) {
  const queryClient = useQueryClient()
  const schema = useMemo(() => connectChannelSchema(copy), [copy])
  const form = useForm<ConnectChannelValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      displayName: "",
      accountSid: "",
      authToken: "",
      address: "",
      inboxId: "",
    },
  })
  const mutation = useMutation({
    mutationFn: (values: ConnectChannelValues) =>
      createTwilioChannel({
        displayName: values.displayName.trim(),
        accountSid: values.accountSid.trim(),
        authToken: values.authToken.trim(),
        address: values.address.replace(/[\s()-]/g, ""),
        ...(values.inboxId.trim() ? { inboxId: values.inboxId.trim() } : {}),
      }),
    onSuccess: () => form.reset(),
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: channelQueryKeys.list(organizationId),
      }),
  })

  function reset() {
    form.reset()
    mutation.reset()
  }

  return { form, mutation, reset }
}
