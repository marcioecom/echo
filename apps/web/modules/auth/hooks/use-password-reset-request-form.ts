"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { authClient } from "@/lib/auth-client"

const passwordResetRequestSchema = z.object({
  email: z.email("Enter a valid email address"),
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
      toast.error(error.message ?? "Could not request a password reset")
      return
    }

    setIsSubmitted(true)
  }

  return { form, isSubmitted, onSubmit }
}
