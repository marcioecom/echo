"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { createTwilioChannel } from "./api"
import { channelQueryKeys } from "./use-channels"

const connectChannelSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "channels.validation.displayName")
    .max(120),
  accountSid: z
    .string()
    .trim()
    .regex(/^AC[a-fA-F0-9]{32}$/, "channels.validation.accountSid"),
  authToken: z.string().trim().min(1, "channels.validation.authToken"),
  address: z
    .string()
    .trim()
    .superRefine((value, context) => {
      const normalized = value.replace(/[\s()-]/g, "")
      if (!/^\+[1-9]\d{1,14}$/.test(normalized)) {
        context.addIssue({
          code: "custom",
          message: "channels.validation.address",
        })
      }
    }),
  inboxId: z.string().trim().max(64),
})

export type ConnectChannelValues = z.infer<typeof connectChannelSchema>

export function useConnectChannelForm(organizationId: string) {
  const queryClient = useQueryClient()
  const form = useForm<ConnectChannelValues>({
    resolver: zodResolver(connectChannelSchema),
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

  return { form, mutation }
}
