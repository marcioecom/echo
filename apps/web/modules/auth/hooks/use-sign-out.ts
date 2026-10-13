"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"

import { authClient } from "@/lib/auth-client"

export function useSignOut() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  return () => {
    authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          queryClient.clear()
          navigate({ to: "/login" })
        },
      },
    })
  }
}
