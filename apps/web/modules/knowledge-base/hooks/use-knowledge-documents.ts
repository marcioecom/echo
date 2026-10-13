"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  knowledgeDocumentQueryKey,
  listKnowledgeDocuments,
  reindexKnowledgeDocument,
} from "./api"

export function useKnowledgeDocuments() {
  const queryClient = useQueryClient()
  const documentsQuery = useQuery({
    queryKey: knowledgeDocumentQueryKey,
    queryFn: listKnowledgeDocuments,
    refetchInterval: (query) =>
      query.state.data?.items.some(
        (document) =>
          document.status === "pending" || document.status === "processing"
      )
        ? 2_000
        : false,
  })
  const reindexMutation = useMutation({
    mutationFn: reindexKnowledgeDocument,
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: knowledgeDocumentQueryKey,
      })
    },
  })

  return { documentsQuery, reindexMutation }
}
