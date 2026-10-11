"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { authClient } from "@/lib/auth-client"

const passwordResetSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
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
      toast.error("This password reset link is invalid or expired")
      return
    }

    const { error } = await authClient.resetPassword({
      newPassword: values.password,
      token,
    })
    if (error) {
      toast.error(error.message ?? "Could not reset your password")
      return
    }

    toast.success("Password reset. Sign in with your new password.")
    navigate({ to: "/login" })
  }

  return { form, hasValidToken: Boolean(token), onSubmit }
}
