import { knowledgeBaseJobNames } from "@workspace/jobs"

import { jobs } from "@/lib/jobs-client"

export async function enqueueKnowledgeStorageDeletions(
  deletionIds: readonly string[]
): Promise<void> {
  await Promise.all(
    deletionIds.map((deletionId) =>
      jobs.enqueue(knowledgeBaseJobNames.deleteKnowledgeObject, { deletionId })
    )
  )
}
