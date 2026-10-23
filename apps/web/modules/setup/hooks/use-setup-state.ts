"use client"

import { useChannels } from "@/modules/channels/hooks/use-channels"
import { useKnowledgeDocuments } from "@/modules/knowledge-base/hooks/use-knowledge-documents"

import { resolveSetupState } from "../state"

export function useSetupState(organizationId: string) {
  const channels = useChannels(organizationId)
  const { documentsQuery } = useKnowledgeDocuments()

  const state = resolveSetupState({
    hasOrganization: true,
    channels: channels.data?.items ?? [],
    documents: documentsQuery.data?.items ?? [],
  })

  return {
    ...state,
    isLoading: channels.isPending || documentsQuery.isPending,
    isError: channels.isError || documentsQuery.isError,
    refetch: () => {
      void channels.refetch()
      void documentsQuery.refetch()
    },
  }
}
