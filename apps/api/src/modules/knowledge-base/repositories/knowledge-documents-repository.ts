import type { Database } from "@workspace/db"
import {
  knowledgeDocuments,
  organizations,
} from "@workspace/db/schema"
import { createId } from "@workspace/domain"
import { and, desc, eq, inArray, sql } from "drizzle-orm"

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

  async find(organizationId: string, id: string) {
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

  async list(organizationId: string) {
    return this.db
      .select({
        id: knowledgeDocuments.id,
        title: knowledgeDocuments.title,
        sourceType: knowledgeDocuments.sourceType,
        sourceName: knowledgeDocuments.sourceName,
        mimeType: knowledgeDocuments.mimeType,
        sourceSizeBytes: knowledgeDocuments.sourceSizeBytes,
        status: knowledgeDocuments.status,
        failureReason: knowledgeDocuments.failureReason,
        revision: knowledgeDocuments.revision,
        createdAt: knowledgeDocuments.createdAt,
        updatedAt: knowledgeDocuments.updatedAt,
      })
      .from(knowledgeDocuments)
      .where(eq(knowledgeDocuments.organizationId, organizationId))
      .orderBy(desc(knowledgeDocuments.updatedAt))
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
    if (!document) throw new Error("Knowledge text document insert returned no row")
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
    const [document] = await this.db
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
      .returning()
    if (!document) throw new Error("Knowledge file document insert returned no row")
    return document
  }

  async queueReindex(organizationId: string, id: string) {
    const [document] = await this.db
      .update(knowledgeDocuments)
      .set({
        status: "pending",
        failureReason: null,
        revision: sql`${knowledgeDocuments.revision} + 1`,
      })
      .where(
        and(
          eq(knowledgeDocuments.organizationId, organizationId),
          eq(knowledgeDocuments.id, id),
          inArray(knowledgeDocuments.status, ["ready", "failed"])
        )
      )
      .returning()
    return document
  }

  async markDispatchFailed(
    organizationId: string,
    id: string,
    revision: number
  ): Promise<void> {
    await this.db
      .update(knowledgeDocuments)
      .set({ status: "failed", failureReason: "index_dispatch_failed" })
      .where(
        and(
          eq(knowledgeDocuments.organizationId, organizationId),
          eq(knowledgeDocuments.id, id),
          eq(knowledgeDocuments.revision, revision),
          eq(knowledgeDocuments.status, "pending")
        )
      )
  }
}

export const knowledgeDocumentsRepository = new KnowledgeDocumentsRepository()
