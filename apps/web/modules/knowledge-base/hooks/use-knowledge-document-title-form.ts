"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { t } from "@/lib/i18n"

import { knowledgeDocumentQueryKey, patchKnowledgeDocument } from "./api"

const knowledgeDocumentTitleSchema = z.object({
  title: z.string().trim().min(1, "knowledge.validation.title").max(255),
})

type KnowledgeDocumentTitleValues = z.infer<typeof knowledgeDocumentTitleSchema>

export function useKnowledgeDocumentTitleForm(input: {
  documentId: string
  title: string
  onSuccess?: () => void
}) {
  const queryClient = useQueryClient()
  const form = useForm<KnowledgeDocumentTitleValues>({
    resolver: zodResolver(knowledgeDocumentTitleSchema),
    defaultValues: { title: input.title },
  })
  const saveMutation = useMutation({
    mutationFn: (values: KnowledgeDocumentTitleValues) =>
      patchKnowledgeDocument(input.documentId, { title: values.title.trim() }),
    onSuccess: () => {
      toast.success(t("knowledge.toast.updated"))
      input.onSuccess?.()
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: knowledgeDocumentQueryKey,
      })
    },
  })

  return { form, saveMutation }
}
