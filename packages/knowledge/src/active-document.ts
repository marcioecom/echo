import { knowledgeDocuments } from "@workspace/db/schema"
import { and, eq, isNull } from "drizzle-orm"

export function activeKnowledgeDocument(organizationId: string) {
  return and(
    eq(knowledgeDocuments.organizationId, organizationId),
    isNull(knowledgeDocuments.deletedAt)
  )
}
