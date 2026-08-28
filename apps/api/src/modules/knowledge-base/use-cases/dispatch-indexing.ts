import { knowledgeBaseJobNames } from "@workspace/jobs"

import { jobs } from "@/lib/jobs-client"

import { knowledgeDocumentsRepository } from "../repositories/knowledge-documents-repository"

export async function dispatchKnowledgeIndexing(input: {
  organizationId: string
  documentId: string
  revision: number
}): Promise<boolean> {
  try {
    await jobs.enqueue(knowledgeBaseJobNames.indexKnowledgeDocument, {
      organizationId: input.organizationId,
      documentId: input.documentId,
      revision: input.revision,
    })
    return true
  } catch {
    await knowledgeDocumentsRepository.markDispatchFailed(
      input.organizationId,
      input.documentId,
      input.revision
    )
    return false
  }
}
