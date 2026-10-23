"use client"

import { Button } from "@workspace/ui/components/button"
import { useState } from "react"
import { toast } from "sonner"

import { track } from "@/lib/analytics"
import { authClient } from "@/lib/auth-client"
import { getAppUrl, isGoogleAuthEnabled } from "@/lib/env"
import { t } from "@/lib/i18n"
import { buildSocialCallbackUrl } from "@/modules/auth/social-callback-url"
import { GoogleMark } from "@/modules/auth/ui/components/google-mark"

type SocialSignInProps = {
  redirectTo: string
  source?: string
  variant?: "signup" | "login"
}

const fallbackRedirect = {
  signup: "/setup",
  login: "/inbox",
} as const

export function SocialSignIn({
  redirectTo,
  source,
  variant = "login",
}: SocialSignInProps) {
  const [isRedirecting, setIsRedirecting] = useState(false)

  if (!isGoogleAuthEnabled()) return null

  async function handleClick() {
    if (variant === "signup") {
      void track(
        "signup_started",
        source ? { method: "google", source } : { method: "google" }
      )
    }

    setIsRedirecting(true)
    const base =
      typeof window === "undefined" ? getAppUrl() : window.location.origin
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: buildSocialCallbackUrl({
        base,
        fallback: fallbackRedirect[variant],
        redirectTo,
      }),
    })
    if (error) {
      setIsRedirecting(false)
      if (variant === "signup") {
        void track("signup_failed", {
          method: "google",
          code: error.code ?? "unknown",
        })
      }
      toast.error(t("auth.errors.social"))
    }
  }

  return (
    <div className="mb-8">
      <Button
        type="button"
        variant="outline"
        className="h-12 w-full gap-2.5 text-base"
        disabled={isRedirecting}
        onClick={handleClick}
      >
        <GoogleMark className="size-5" />
        {t("auth.social.continueWithGoogle")}
      </Button>
      <div className="mt-6 flex items-center gap-3">
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
        <span className="text-sm text-muted-foreground">
          {t("auth.social.or")}
        </span>
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
      </div>
    </div>
  )
}
