"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"

import { clearAuthQueries } from "@/modules/auth/queries"

export function useNavigateAfterAuth() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return async function navigateAfterAuth(href: string) {
    clearAuthQueries(queryClient)
    await router.invalidate()
    await router.navigate({ href })
  }
}
