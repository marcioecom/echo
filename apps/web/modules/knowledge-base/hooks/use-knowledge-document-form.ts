"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { z } from "zod"

import {
  completeKnowledgeUpload,
  createKnowledgeUpload,
  createTextKnowledgeDocument,
  listKnowledgeDocuments,
  reindexKnowledgeDocument,
  uploadKnowledgeFile,
} from "./api"

const knowledgeDocumentSchema = z.object({
  title: z.string().trim().min(1, "Enter a title").max(255),
  sourceType: z.enum(["text", "file"]),
  content: z.string(),
  file: z.custom<File | null>(),
}).superRefine((values, context) => {
  if (values.sourceType === "text" && values.content.trim().length === 0) {
    context.addIssue({ code: "custom", path: ["content"], message: "Enter support knowledge" })
  }
  if (values.sourceType === "file" && !(values.file instanceof File)) {
    context.addIssue({ code: "custom", path: ["file"], message: "Choose a file" })
  }
})

type KnowledgeDocumentFormValues = z.infer<typeof knowledgeDocumentSchema>

export function useKnowledgeDocumentForm() {
  const queryClient = useQueryClient()
  const form = useForm<KnowledgeDocumentFormValues>({
    resolver: zodResolver(knowledgeDocumentSchema),
    defaultValues: { title: "", sourceType: "text", content: "", file: null },
  })
  const documentsQuery = useQuery({
    queryKey: ["knowledge-documents"],
    queryFn: listKnowledgeDocuments,
    refetchInterval: (query) =>
      query.state.data?.items.some(
        (document) => document.status === "pending" || document.status === "processing"
      )
        ? 2_000
        : false,
  })
  const createMutation = useMutation({
    mutationFn: async (values: KnowledgeDocumentFormValues) => {
      if (values.sourceType === "text") {
        return createTextKnowledgeDocument({ title: values.title, content: values.content.trim() })
      }
      const file = values.file
      if (!(file instanceof File)) throw new Error("Choose a file")
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
      if (!uploadResponse.ok) throw new Error("The file upload could not be completed.")
      return completeKnowledgeUpload({ title: values.title, uploadToken: upload.uploadToken })
    },
    onSuccess: () => form.reset(),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["knowledge-documents"] })
    },
  })
  const reindexMutation = useMutation({
    mutationFn: reindexKnowledgeDocument,
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["knowledge-documents"] })
    },
  })

  return { form, documentsQuery, createMutation, reindexMutation }
}
