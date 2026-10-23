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
import { displayNameFromEmail } from "@/modules/auth/display-name"
import { useNavigateAfterAuth } from "@/modules/auth/hooks/use-navigate-after-auth"
import { createOrganization } from "@/modules/setup/lib/create-organization"

const signUpSchema = z.object({
  organizationName: z.string().min(1, "auth.validation.organizationName"),
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
      organizationName: "",
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
      name: displayNameFromEmail(values.email),
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

    // An invitation creates the Membership, not an Organization of its own.
    if (!redirectTo.startsWith("/accept-invitation")) {
      try {
        await createOrganization(values.organizationName)
      } catch {
        // Signup never blocks on the Organization; /setup can create it later.
      }
    }

    await navigateAfterAuth(redirectTo)
  }

  return { form, onSubmit, onFormFocus, redirectTo }
}
