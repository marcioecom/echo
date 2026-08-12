"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { inboxQueryKeys } from "./use-inbox-conversations"
import { inboxApiRequest } from "./api"

const replySchema = z.object({
  body: z.string().trim().min(1, "Write a reply before sending.").max(1600),
})

type ReplyFormValues = z.infer<typeof replySchema>

export function useReplyForm(input: {
  organizationId: string
  conversationId: string
}) {
  const queryClient = useQueryClient()
  const form = useForm<ReplyFormValues>({
    resolver: zodResolver(replySchema),
    defaultValues: { body: "" },
  })

  const replyMutation = useMutation({
    mutationFn: (values: ReplyFormValues) =>
      inboxApiRequest<{ messageId: string }>(
        `/v1/support-conversations/${input.conversationId}/messages`,
        { method: "POST", body: values }
      ),
    onSuccess: async () => {
      form.reset()
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: inboxQueryKeys.detail(
            input.organizationId,
            input.conversationId
          ),
        }),
        queryClient.invalidateQueries({
          queryKey: inboxQueryKeys.lists(input.organizationId),
        }),
      ])
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  return { form, replyMutation }
}
