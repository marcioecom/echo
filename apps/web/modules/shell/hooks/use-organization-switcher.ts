"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { startTransition, useState } from "react"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"

export type OrganizationOption = {
  id: string
  name: string
  slug: string
}

export function useOrganizationSwitcher(activeOrganizationId: string) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [switchingOrganizationId, setSwitchingOrganizationId] = useState<
    string | null
  >(null)

  const organizationsQuery = useQuery({
    queryKey: ["organizations"],
    queryFn: async (): Promise<OrganizationOption[]> => {
      const { data, error } = await authClient.organization.list()
      if (error) throw new Error(error.message)
      return data ?? []
    },
  })

  const switchMutation = useMutation({
    mutationFn: async (organizationId: string) => {
      const { error } = await authClient.organization.setActive({
        organizationId,
      })
      if (error) throw new Error(error.message)
    },
  })

  async function switchOrganization(organizationId: string) {
    if (organizationId === activeOrganizationId) return true

    setSwitchingOrganizationId(organizationId)
    try {
      await switchMutation.mutateAsync(organizationId)
      await queryClient.invalidateQueries({ queryKey: ["organization"] })
      startTransition(() => {
        router.replace("/")
        router.refresh()
      })
      return true
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not switch organization"
      )
      return false
    } finally {
      setSwitchingOrganizationId(null)
    }
  }

  return {
    organizations: organizationsQuery.data ?? [],
    isLoading: organizationsQuery.isLoading,
    isError: organizationsQuery.isError,
    isSwitching: switchMutation.isPending,
    switchingOrganizationId,
    refetch: organizationsQuery.refetch,
    switchOrganization,
  }
}
