"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"

export function useAcceptInvitation(invitationId: string) {
  const router = useRouter()

  const invitationQuery = useQuery({
    queryKey: ["organization", "invitation", invitationId],
    queryFn: async () => {
      const { data, error } = await authClient.organization.getInvitation({
        query: { id: invitationId },
      })
      if (error || !data) {
        throw new Error(error?.message ?? "Invalid invitation")
      }
      return data
    },
    retry: false,
  })

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await authClient.organization.acceptInvitation({
        invitationId,
      })
      if (error || !data) {
        throw new Error(error?.message ?? "Could not accept the invitation")
      }
      if (data.invitation.organizationId) {
        await authClient.organization.setActive({
          organizationId: data.invitation.organizationId,
        })
      }
    },
    onSuccess: () => {
      router.push("/")
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  return {
    invitation: invitationQuery.data,
    isInvalid: invitationQuery.isError,
    acceptMutation,
  }
}
