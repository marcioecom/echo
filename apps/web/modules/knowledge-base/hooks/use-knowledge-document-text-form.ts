"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { t } from "@/lib/i18n"

import { knowledgeDocumentQueryKey, patchKnowledgeDocument } from "./api"

const knowledgeDocumentTextSchema = z.object({
  title: z.string().trim().min(1, "knowledge.validation.title").max(255),
  content: z
    .string()
    .trim()
    .min(1, "knowledge.validation.content")
    .max(1_000_000),
})

type KnowledgeDocumentTextValues = z.infer<typeof knowledgeDocumentTextSchema>

export function useKnowledgeDocumentTextForm(input: {
  documentId: string
  title: string
  content: string
  onSuccess?: () => void
}) {
  const queryClient = useQueryClient()
  const form = useForm<KnowledgeDocumentTextValues>({
    resolver: zodResolver(knowledgeDocumentTextSchema),
    defaultValues: { title: input.title, content: input.content },
  })
  const saveMutation = useMutation({
    mutationFn: (values: KnowledgeDocumentTextValues) =>
      patchKnowledgeDocument(input.documentId, {
        title: values.title,
        content: values.content.trim(),
      }),
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
