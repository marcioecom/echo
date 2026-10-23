"use client"

import { GoogleIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import { useState } from "react"
import { toast } from "sonner"

import { track } from "@/lib/analytics"
import { authClient } from "@/lib/auth-client"
import { getAppUrl, isGoogleAuthEnabled } from "@/lib/env"
import { t, translateMessage } from "@/lib/i18n"

type SocialSignInProps = {
  redirectTo: string
  variant?: "signup" | "login"
}

const fallbackRedirect = {
  signup: "/setup",
  login: "/inbox",
} as const

function buildCallbackUrl(redirectTo: string, fallback: string) {
  const base =
    typeof window === "undefined" ? getAppUrl() : window.location.origin
  const path =
    redirectTo.startsWith("/") &&
    !redirectTo.startsWith("//") &&
    !redirectTo.startsWith("/\\")
      ? redirectTo
      : fallback
  return new URL(path, base).toString()
}

export function SocialSignIn({
  redirectTo,
  variant = "login",
}: SocialSignInProps) {
  const [isRedirecting, setIsRedirecting] = useState(false)

  if (!isGoogleAuthEnabled()) return null

  async function handleClick() {
    if (variant === "signup") {
      void track("signup_started", { method: "google" })
    }

    setIsRedirecting(true)
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: buildCallbackUrl(redirectTo, fallbackRedirect[variant]),
    })
    if (error) {
      setIsRedirecting(false)
      toast.error(translateMessage(error.message ?? "auth.errors.social"))
    }
  }

  return (
    <div className="mb-6">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={isRedirecting}
        onClick={handleClick}
      >
        <HugeiconsIcon icon={GoogleIcon} size={16} strokeWidth={1.8} />
        {t("auth.social.continueWithGoogle")}
      </Button>
      <div className="mt-5 flex items-center gap-3">
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">
          {t("auth.social.or")}
        </span>
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
      </div>
    </div>
  )
}
