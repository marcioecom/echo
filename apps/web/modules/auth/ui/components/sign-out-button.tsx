"use client"

import { Button } from "@workspace/ui/components/button"
import { useRouter } from "next/navigation"

import { authClient } from "@/lib/auth-client"

type SignOutButtonProps = Omit<
  React.ComponentProps<typeof Button>,
  "onClick"
>

export function SignOutButton({
  variant = "outline",
  children = "Sign out",
  ...props
}: SignOutButtonProps) {
  const router = useRouter()

  return (
    <Button
      variant={variant}
      onClick={() =>
        authClient.signOut({
          fetchOptions: {
            onSuccess: () => {
              router.push("/login")
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
