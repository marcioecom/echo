"use client"

import { Link } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"

import { authClient } from "@/lib/auth-client"

type SignInButtonProps = Omit<
  React.ComponentProps<typeof Button>,
  "asChild" | "children"
> & {
  children?: React.ReactNode
}

export function SignInButton({
  children = "Sign in",
  ...props
}: SignInButtonProps) {
  const { data } = authClient.useSession()

  return (
    <Button asChild {...props}>
      <Link to={data?.session ? "/inbox" : "/login"}>
        {data?.session ? "Dashboard" : children}
      </Link>
    </Button>
  )
}
