"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { t } from "@/lib/i18n"

import {
  createKnowledgeUpload,
  knowledgeDocumentQueryKey,
  replaceKnowledgeDocumentFile,
  uploadKnowledgeFile,
} from "./api"

export function useReplaceKnowledgeDocumentFile(input: {
  documentId: string
  onSuccess?: () => void
}) {
  const queryClient = useQueryClient()
  const replaceMutation = useMutation({
    mutationFn: async (file: File) => {
      let upload = await createKnowledgeUpload({
        fileName: file.name,
        contentType: file.type,
        sizeBytes: file.size,
      })
      let uploadResponse = await uploadKnowledgeFile(file, upload)
      if (uploadResponse.status === 403) {
        upload = await createKnowledgeUpload({
          fileName: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        })
        uploadResponse = await uploadKnowledgeFile(file, upload)
      }
      if (!uploadResponse.ok) throw new Error("knowledge.errors.upload")
      return replaceKnowledgeDocumentFile(input.documentId, {
        uploadToken: upload.uploadToken,
      })
    },
    onSuccess: () => {
      toast.success(t("knowledge.toast.replaced"))
      input.onSuccess?.()
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: knowledgeDocumentQueryKey,
      })
    },
  })

  return { replaceMutation }
}
