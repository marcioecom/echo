"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { authClient } from "@/lib/auth-client"
import { t, translateMessage } from "@/lib/i18n"

const passwordResetSchema = z
  .object({
    password: z.string().min(8, "auth.validation.passwordMin"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "auth.validation.passwordMismatch",
    path: ["confirmPassword"],
  })

type PasswordResetFormValues = z.infer<typeof passwordResetSchema>

export function usePasswordResetForm() {
  const navigate = useNavigate()
  const search = useSearch({ strict: false })
  const token = typeof search.token === "string" ? search.token : null
  const form = useForm<PasswordResetFormValues>({
    resolver: zodResolver(passwordResetSchema),
    defaultValues: { password: "", confirmPassword: "" },
  })

  async function onSubmit(values: PasswordResetFormValues) {
    if (!token) {
      toast.error(t("auth.errors.resetInvalid"))
      return
    }

    const { error } = await authClient.resetPassword({
      newPassword: values.password,
      token,
    })
    if (error) {
      toast.error(translateMessage(error.message ?? "auth.errors.reset"))
      return
    }

    toast.success(t("auth.reset.success"))
    navigate({ to: "/login" })
  }

  return { form, hasValidToken: Boolean(token), onSubmit }
}
