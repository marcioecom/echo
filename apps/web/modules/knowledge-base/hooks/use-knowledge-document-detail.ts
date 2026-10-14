"use client"

import { useQuery } from "@tanstack/react-query"

import { getKnowledgeDocument, knowledgeDocumentDetailQueryKey } from "./api"

export function useKnowledgeDocumentDetail(documentId: string) {
  const query = useQuery({
    queryKey: knowledgeDocumentDetailQueryKey(documentId),
    queryFn: () => getKnowledgeDocument(documentId),
    refetchInterval: (current) => {
      const status = current.state.data?.document.status
      if (status === "pending" || status === "processing") return 2_000
      return false
    },
  })

  return { query }
}
