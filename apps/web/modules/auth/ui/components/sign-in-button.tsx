"use client"

import { Link } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"

import { authClient } from "@/lib/auth-client"
import { t } from "@/lib/i18n"

type SignInButtonProps = Omit<
  React.ComponentProps<typeof Button>,
  "asChild" | "children"
> & {
  children?: React.ReactNode
}

export function SignInButton({
  children = t("auth.login.submit"),
  ...props
}: SignInButtonProps) {
  const { data } = authClient.useSession()

  return (
    <Button asChild {...props}>
      <Link to={data?.session ? "/inbox" : "/login"}>
        {data?.session ? t("auth.dashboard") : children}
      </Link>
    </Button>
  )
}
