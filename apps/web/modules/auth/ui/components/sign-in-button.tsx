import { Button } from "@workspace/ui/components/button"
import Link from "next/link"

import { getSession } from "@/modules/auth/server/session"

type SignInButtonProps = Omit<
  React.ComponentProps<typeof Button>,
  "asChild" | "children"
> & {
  children?: React.ReactNode
}

export async function SignInButton({
  children = "Sign in",
  ...props
}: SignInButtonProps) {
  const session = await getSession()

  return (
    <Button asChild {...props}>
      <Link href={session ? "/inbox" : "/login"}>
        {session ? "Dashboard" : children}
      </Link>
    </Button>
  )
}
