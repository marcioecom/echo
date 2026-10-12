"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { requestPairingCode } from "./api"

const pairingCodeSchema = z.object({
  phoneNumber: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{1,14}$/, "channels.validation.address"),
})

export type PairingCodeValues = z.infer<typeof pairingCodeSchema>

export function usePairingCodeForm(
  channelConnectionId: string,
  phoneNumber: string | null
) {
  const form = useForm<PairingCodeValues>({
    resolver: zodResolver(pairingCodeSchema),
    defaultValues: { phoneNumber: phoneNumber ?? "" },
  })
  const mutation = useMutation({
    mutationFn: (values: PairingCodeValues) =>
      requestPairingCode(channelConnectionId, values.phoneNumber.trim()),
  })

  return { form, mutation }
}
