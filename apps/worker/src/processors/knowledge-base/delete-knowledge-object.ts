import { deleteRetiredKnowledgeObject } from "@workspace/knowledge"
import { deleteKnowledgeObjectJobSchema } from "@workspace/jobs"
import type { Job } from "bullmq"

import { database } from "../../lib/db"
import { objectStore } from "../../lib/object-store"

export async function handleDeleteKnowledgeObject(job: Job): Promise<void> {
  const payload = deleteKnowledgeObjectJobSchema.parse(job.data)
  await deleteRetiredKnowledgeObject(
    database.db,
    payload.deletionId,
    (objectKey) => objectStore.delete(objectKey)
  )
}
