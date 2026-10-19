import type { Database } from "@workspace/db"
import { knowledgeDocuments, organizations } from "@workspace/db/schema"
import { createId } from "@workspace/domain"
import { and, eq } from "drizzle-orm"

import { database } from "@/lib/db"

export class KnowledgeDocumentsRepository {
  constructor(private readonly db: Database = database.db) {}

  async hasActiveOrganization(organizationId: string): Promise<boolean> {
    const [organization] = await this.db
      .select({ id: organizations.id })
      .from(organizations)
      .where(
        and(
          eq(organizations.id, organizationId),
          eq(organizations.status, "active")
        )
      )
      .limit(1)
    return organization !== undefined
  }

  async findIncludingRetired(organizationId: string, id: string) {
    const [document] = await this.db
      .select()
      .from(knowledgeDocuments)
      .where(
        and(
          eq(knowledgeDocuments.organizationId, organizationId),
          eq(knowledgeDocuments.id, id)
        )
      )
      .limit(1)
    return document
  }

  async createText(input: {
    organizationId: string
    createdByUserId: string
    title: string
    content: string
  }) {
    const [document] = await this.db
      .insert(knowledgeDocuments)
      .values({
        id: createId(),
        organizationId: input.organizationId,
        createdByUserId: input.createdByUserId,
        title: input.title,
        sourceType: "text",
        content: input.content,
      })
      .returning()
    if (!document)
      throw new Error("Knowledge text document insert returned no row")
    return document
  }

  async createFile(input: {
    id: string
    organizationId: string
    createdByUserId: string
    title: string
    sourceName: string
    mimeType: string
    sourceObjectKey: string
    sourceObjectEtag: string
    sourceSizeBytes: number
  }) {
    const [inserted] = await this.db
      .insert(knowledgeDocuments)
      .values({
        id: input.id,
        organizationId: input.organizationId,
        createdByUserId: input.createdByUserId,
        title: input.title,
        sourceType: "file",
        sourceName: input.sourceName,
        mimeType: input.mimeType,
        sourceObjectKey: input.sourceObjectKey,
        sourceObjectEtag: input.sourceObjectEtag,
        sourceSizeBytes: input.sourceSizeBytes,
      })
      .onConflictDoNothing({ target: knowledgeDocuments.id })
      .returning()
    if (inserted) return inserted

    const existing = await this.findIncludingRetired(
      input.organizationId,
      input.id
    )
    if (!existing)
      throw new Error("Knowledge file document insert returned no row")
    return existing
  }
}

export const knowledgeDocumentsRepository = new KnowledgeDocumentsRepository()
