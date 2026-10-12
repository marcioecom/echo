"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { authClient } from "@/lib/auth-client"
import { translateMessage } from "@/lib/i18n"

const passwordResetRequestSchema = z.object({
  email: z.email("auth.validation.email"),
})

type PasswordResetRequestFormValues = z.infer<typeof passwordResetRequestSchema>

export function usePasswordResetRequestForm() {
  const [isSubmitted, setIsSubmitted] = useState(false)
  const form = useForm<PasswordResetRequestFormValues>({
    resolver: zodResolver(passwordResetRequestSchema),
    defaultValues: { email: "" },
  })

  async function onSubmit(values: PasswordResetRequestFormValues) {
    const { error } = await authClient.requestPasswordReset({
      email: values.email,
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) {
      toast.error(translateMessage(error.message ?? "auth.errors.resetRequest"))
      return
    }

    setIsSubmitted(true)
  }

  return { form, isSubmitted, onSubmit }
}
