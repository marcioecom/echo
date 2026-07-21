"use client"

import { Button } from "@workspace/ui/components/button"
import { useRouter } from "next/navigation"

import { authClient } from "@/lib/auth-client"

export function SignOutButton() {
  const router = useRouter()

  return (
    <Button
      variant="outline"
      onClick={() =>
        authClient.signOut({
          fetchOptions: {
            onSuccess: () => {
              router.push("/login")
            },
          },
        })
      }
    >
      Sign out
    </Button>
  )
}
