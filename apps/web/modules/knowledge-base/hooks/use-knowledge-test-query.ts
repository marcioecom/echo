"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { testKnowledgeQuery } from "./api"
import type { KnowledgeTestResponse } from "../types"

const knowledgeTestSchema = z.object({
  question: z.string().trim().min(1, "knowledge.validation.question").max(2000),
})

type KnowledgeTestValues = z.infer<typeof knowledgeTestSchema>

export function useKnowledgeTestQuery() {
  const [result, setResult] = useState<KnowledgeTestResponse | null>(null)
  const form = useForm<KnowledgeTestValues>({
    resolver: zodResolver(knowledgeTestSchema),
    defaultValues: { question: "" },
  })
  const testMutation = useMutation({
    mutationFn: (values: KnowledgeTestValues) =>
      testKnowledgeQuery({ question: values.question.trim() }),
    onSuccess: (response) => {
      setResult(response)
    },
  })

  return { form, result, testMutation }
}
