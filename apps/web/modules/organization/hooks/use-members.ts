"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"

function canManage(role: string): boolean {
  return role
    .split(",")
    .some((entry) => ["owner", "admin"].includes(entry.trim()))
}

export function useMembers(currentRole: string) {
  const queryClient = useQueryClient()
  const manageable = canManage(currentRole)

  const organizationQuery = useQuery({
    queryKey: ["organization", "full"],
    queryFn: async () => {
      const { data, error } =
        await authClient.organization.getFullOrganization()
      if (error) throw new Error(error.message)
      return data
    },
  })

  const invitationsQuery = useQuery({
    queryKey: ["organization", "invitations"],
    queryFn: async () => {
      const { data, error } = await authClient.organization.listInvitations()
      if (error) throw new Error(error.message)
      return data ?? []
    },
    enabled: manageable,
  })

  const cancelInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await authClient.organization.cancelInvitation({
        invitationId,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["organization", "invitations"],
      })
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const members = organizationQuery.data?.members ?? []
  const pendingInvitations = (invitationsQuery.data ?? []).filter(
    (invitation) => invitation.status === "pending"
  )

  return {
    members,
    pendingInvitations,
    manageable,
    cancelInvitationMutation,
  }
}
