"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { organizationRoleNames } from "@workspace/auth"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { authClient } from "@/lib/auth-client"

const inviteSchema = z.object({
  email: z.email("Enter a valid email address"),
  role: z.enum(organizationRoleNames),
})

type InviteFormValues = z.infer<typeof inviteSchema>

export function useInviteMemberForm() {
  const queryClient = useQueryClient()

  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", role: "operator" },
  })

  const inviteMutation = useMutation({
    mutationFn: async (values: InviteFormValues) => {
      const { error } = await authClient.organization.inviteMember(values)
      if (error) throw new Error(error.message)
    },
    onSuccess: async () => {
      form.reset()
      await queryClient.invalidateQueries({
        queryKey: ["organization", "invitations"],
      })
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  return { form, inviteMutation }
}
