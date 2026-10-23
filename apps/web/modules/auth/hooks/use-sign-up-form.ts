"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useSearch } from "@tanstack/react-router"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { track } from "@/lib/analytics"
import { authClient } from "@/lib/auth-client"
import { translateMessage } from "@/lib/i18n"
import { useNavigateAfterAuth } from "@/modules/auth/hooks/use-navigate-after-auth"

const signUpSchema = z
  .object({
    name: z.string().min(1, "auth.validation.name"),
    email: z.email("auth.validation.email"),
    password: z.string().min(8, "auth.validation.passwordMin"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "auth.validation.passwordMismatch",
    path: ["confirmPassword"],
  })

type SignUpFormValues = z.infer<typeof signUpSchema>

export function useSignUpForm() {
  const navigateAfterAuth = useNavigateAfterAuth()
  const search = useSearch({ strict: false })
  const redirectTo =
    typeof search.redirect === "string" && search.redirect.startsWith("/")
      ? search.redirect
      : "/setup"

  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  })

  async function onSubmit(values: SignUpFormValues) {
    void track("signup_started", { method: "email" })

    const { error } = await authClient.signUp.email({
      name: values.name,
      email: values.email,
      password: values.password,
    })
    if (error) {
      toast.error(translateMessage(error.message ?? "auth.errors.signUp"))
      return
    }
    await navigateAfterAuth(redirectTo)
  }

  return { form, onSubmit, redirectTo }
}
