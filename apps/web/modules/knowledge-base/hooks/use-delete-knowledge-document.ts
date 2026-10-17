"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { t } from "@/lib/i18n"

import { deleteKnowledgeDocument, knowledgeDocumentQueryKey } from "./api"

export function useDeleteKnowledgeDocument(options?: {
  onSuccess?: () => void
}) {
  const queryClient = useQueryClient()
  const deleteMutation = useMutation({
    mutationFn: deleteKnowledgeDocument,
    onSuccess: async () => {
      toast.success(t("knowledge.toast.deleted"))
      options?.onSuccess?.()
      await queryClient.invalidateQueries({
        queryKey: knowledgeDocumentQueryKey,
      })
    },
  })

  return { deleteMutation }
}
