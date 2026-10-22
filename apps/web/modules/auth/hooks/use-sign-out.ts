"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"

import { resetAnalytics } from "@/lib/analytics"
import { authClient } from "@/lib/auth-client"

export function useSignOut() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  return () => {
    authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          void resetAnalytics()
          queryClient.clear()
          navigate({ to: "/login" })
        },
      },
    })
  }
}
