"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useSearch } from "@tanstack/react-router"
import { useEffect, useRef } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { track } from "@/lib/analytics"
import { authClient } from "@/lib/auth-client"
import { t } from "@/lib/i18n"
import { useNavigateAfterAuth } from "@/modules/auth/hooks/use-navigate-after-auth"

const signUpSchema = z.object({
  name: z.string().min(1, "auth.validation.name"),
  email: z.email("auth.validation.email"),
  password: z.string().min(8, "auth.validation.passwordMin"),
})

type SignUpFormValues = z.infer<typeof signUpSchema>

const emailTakenErrorCodes = new Set([
  "USER_ALREADY_EXISTS",
  "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
])

export function useSignUpForm() {
  const navigateAfterAuth = useNavigateAfterAuth()
  const search = useSearch({ strict: false })
  const source = typeof search.source === "string" ? search.source : undefined
  const redirectTo =
    typeof search.redirect === "string" && search.redirect.startsWith("/")
      ? search.redirect
      : "/setup"

  const viewedRef = useRef(false)
  const startedRef = useRef(false)

  useEffect(() => {
    if (viewedRef.current) return
    viewedRef.current = true
    void track("signup_viewed", source ? { source } : {})
  }, [source])

  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  })

  function onFormFocus() {
    if (startedRef.current) return
    startedRef.current = true
    void track(
      "signup_started",
      source ? { method: "email", source } : { method: "email" }
    )
  }

  async function onSubmit(values: SignUpFormValues) {
    const { error } = await authClient.signUp.email({
      name: values.name,
      email: values.email,
      password: values.password,
    })
    if (error) {
      const code = error.code ?? "unknown"
      void track("signup_failed", { method: "email", code })

      if (error.code && emailTakenErrorCodes.has(error.code)) {
        form.setError("email", {
          type: "server",
          message: "auth.errors.emailTaken",
        })
        return
      }

      toast.error(t("auth.errors.signUp"))
      return
    }
    await navigateAfterAuth(redirectTo)
  }

  return { form, onSubmit, onFormFocus }
}
