"use client"

import { Button } from "@workspace/ui/components/button"

import { t } from "@/lib/i18n"
import { useSignOut } from "@/modules/auth/hooks/use-sign-out"

type SignOutButtonProps = Omit<React.ComponentProps<typeof Button>, "onClick">

export function SignOutButton({
  variant = "outline",
  children = t("shell.signOut"),
  ...props
}: SignOutButtonProps) {
  const signOut = useSignOut()

  return (
    <Button variant={variant} onClick={signOut} {...props}>
      {children}
    </Button>
  )
}
