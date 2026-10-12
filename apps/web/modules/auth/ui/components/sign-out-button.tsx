"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"

import { authClient } from "@/lib/auth-client"
import { t } from "@/lib/i18n"

type SignOutButtonProps = Omit<React.ComponentProps<typeof Button>, "onClick">

export function SignOutButton({
  variant = "outline",
  children = t("shell.signOut"),
  ...props
}: SignOutButtonProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  return (
    <Button
      variant={variant}
      onClick={() =>
        authClient.signOut({
          fetchOptions: {
            onSuccess: () => {
              queryClient.clear()
              navigate({ to: "/login" })
            },
          },
        })
      }
      {...props}
    >
      {children}
    </Button>
  )
}
