import { markIndexDispatchFailed } from "@workspace/knowledge"
import { knowledgeBaseJobNames } from "@workspace/jobs"

import { database } from "@/lib/db"
import { jobs } from "@/lib/jobs-client"

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
    await markIndexDispatchFailed(database.db, input)
    return false
  }
}
