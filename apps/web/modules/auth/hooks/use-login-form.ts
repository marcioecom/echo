"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useSearch } from "@tanstack/react-router"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { authClient } from "@/lib/auth-client"
import { translateMessage } from "@/lib/i18n"
import { useNavigateAfterAuth } from "@/modules/auth/hooks/use-navigate-after-auth"

const loginSchema = z.object({
  email: z.email("auth.validation.email"),
  password: z.string().min(1, "auth.validation.password"),
})

type LoginFormValues = z.infer<typeof loginSchema>

export function useLoginForm() {
  const navigateAfterAuth = useNavigateAfterAuth()
  const search = useSearch({ strict: false })
  const redirectTo =
    typeof search.redirect === "string" && search.redirect.startsWith("/")
      ? search.redirect
      : "/inbox"

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  async function onSubmit(values: LoginFormValues) {
    const { error } = await authClient.signIn.email({
      email: values.email,
      password: values.password,
    })
    if (error) {
      toast.error(translateMessage(error.message ?? "auth.errors.signIn"))
      return
    }
    await navigateAfterAuth(redirectTo)
  }

  return { form, onSubmit }
}
