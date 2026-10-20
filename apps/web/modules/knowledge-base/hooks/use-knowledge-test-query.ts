"use client"

import type { KnowledgePreviewResponse } from "../types"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { previewKnowledgeResponse } from "./api"

const knowledgeTestSchema = z.object({
  question: z.string().trim().min(1, "knowledge.validation.question").max(2000),
})

type KnowledgeTestValues = z.infer<typeof knowledgeTestSchema>

export function useKnowledgePreviewQuery() {
  const [result, setResult] = useState<KnowledgePreviewResponse | null>(null)
  const form = useForm<KnowledgeTestValues>({
    resolver: zodResolver(knowledgeTestSchema),
    defaultValues: { question: "" },
  })
  const previewMutation = useMutation({
    mutationFn: (values: KnowledgeTestValues) =>
      previewKnowledgeResponse({ question: values.question.trim() }),
    onMutate: () => {
      setResult(null)
    },
    onSuccess: (response) => {
      setResult(response)
    },
  })
  return { form, result, previewMutation }
}
