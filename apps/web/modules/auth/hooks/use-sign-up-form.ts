"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useSearch } from "@tanstack/react-router"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { track } from "@/lib/analytics"
import { authClient } from "@/lib/auth-client"
import { translateMessage } from "@/lib/i18n"
import { displayNameFromEmail } from "@/modules/auth/display-name"
import { useNavigateAfterAuth } from "@/modules/auth/hooks/use-navigate-after-auth"
import { createOrganization } from "@/modules/setup/lib/create-organization"

const signUpSchema = z
  .object({
    organizationName: z.string().min(1, "auth.validation.organizationName"),
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
      organizationName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  })

  async function onSubmit(values: SignUpFormValues) {
    void track("signup_started", { method: "email" })

    const { error } = await authClient.signUp.email({
      name: displayNameFromEmail(values.email),
      email: values.email,
      password: values.password,
    })
    if (error) {
      toast.error(translateMessage(error.message ?? "auth.errors.signUp"))
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

  return { form, onSubmit }
}
