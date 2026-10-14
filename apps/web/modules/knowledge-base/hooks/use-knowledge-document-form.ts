"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { z } from "zod"

import {
  completeKnowledgeUpload,
  createKnowledgeUpload,
  createTextKnowledgeDocument,
  knowledgeDocumentQueryKey,
  uploadKnowledgeFile,
} from "./api"

const knowledgeDocumentSchema = z
  .object({
    title: z.string().trim().min(1, "knowledge.validation.title").max(255),
    sourceType: z.enum(["text", "file"]),
    content: z.string(),
    file: z.custom<File | null>(),
  })
  .superRefine((values, context) => {
    if (values.sourceType === "text" && values.content.trim().length === 0) {
      context.addIssue({
        code: "custom",
        path: ["content"],
        message: "knowledge.validation.content",
      })
    }
    if (values.sourceType === "file" && !(values.file instanceof File)) {
      context.addIssue({
        code: "custom",
        path: ["file"],
        message: "knowledge.validation.file",
      })
    }
  })

type KnowledgeDocumentFormValues = z.infer<typeof knowledgeDocumentSchema>

export function useKnowledgeDocumentForm(options?: { onSuccess?: () => void }) {
  const queryClient = useQueryClient()
  const form = useForm<KnowledgeDocumentFormValues>({
    resolver: zodResolver(knowledgeDocumentSchema),
    defaultValues: { title: "", sourceType: "text", content: "", file: null },
  })
  const createMutation = useMutation({
    mutationFn: async (values: KnowledgeDocumentFormValues) => {
      if (values.sourceType === "text") {
        return createTextKnowledgeDocument({
          title: values.title,
          content: values.content.trim(),
        })
      }
      const file = values.file
      if (!(file instanceof File)) throw new Error("knowledge.validation.file")
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
      return completeKnowledgeUpload({
        title: values.title,
        uploadToken: upload.uploadToken,
      })
    },
    onSuccess: () => {
      form.reset()
      options?.onSuccess?.()
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: knowledgeDocumentQueryKey,
      })
    },
  })

  return { form, createMutation }
}
