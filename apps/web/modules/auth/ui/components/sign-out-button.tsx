"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"

import { authClient } from "@/lib/auth-client"

type SignOutButtonProps = Omit<React.ComponentProps<typeof Button>, "onClick">

export function SignOutButton({
  variant = "outline",
  children = "Sign out",
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
