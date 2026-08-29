import { TextDecoder } from "node:util"

import { OpenAIEmbeddings } from "@langchain/openai"
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters"
import {
  knowledgeDocumentChunks,
  knowledgeDocuments,
} from "@workspace/db/schema"
import { indexKnowledgeDocumentJobSchema } from "@workspace/jobs"
import mammoth from "mammoth"
import type { Job } from "bullmq"
import { and, eq } from "drizzle-orm"
import { extractText, getDocumentProxy } from "unpdf"

import { env } from "../../config/env"
import { database } from "../../lib/db"
import { objectStore } from "../../lib/object-store"

const maxFileBytes = 10_485_760
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 50,
})
const embeddings = new OpenAIEmbeddings({
  apiKey: env.AI_GATEWAY_API_KEY,
  model: env.AI_EMBEDDING_MODEL,
  configuration: { baseURL: "https://ai-gateway.vercel.sh/v1" },
})

export async function handleIndexKnowledgeDocument(job: Job): Promise<void> {
  const payload = indexKnowledgeDocumentJobSchema.parse(job.data)
  try {
    const document = await loadCurrentDocument(payload)
    if (!document || document.revision !== payload.revision || document.status === "ready") {
      return
    }
    const [processing] = await database.db
      .update(knowledgeDocuments)
      .set({ status: "processing", failureReason: null })
      .where(
        and(
          eq(knowledgeDocuments.organizationId, payload.organizationId),
          eq(knowledgeDocuments.id, payload.documentId),
          eq(knowledgeDocuments.revision, payload.revision),
          eq(knowledgeDocuments.status, document.status)
        )
      )
      .returning({ id: knowledgeDocuments.id })
    if (!processing) return

    const content = document.sourceType === "text"
      ? document.content
      : await extractFileContent(document)
    const normalizedContent = normalizeContent(content)
    if (!normalizedContent) throw new Error("Knowledge document has no readable content")

    const chunks = await splitter.splitText(normalizedContent)
    if (chunks.length === 0) throw new Error("Knowledge document produced no chunks")
    const vectors = await embeddings.embedDocuments(chunks)
    if (vectors.length !== chunks.length) {
      throw new Error("Knowledge document embedding count does not match chunks")
    }

    await database.db.transaction(async (transaction) => {
      const [current] = await transaction
        .select({ revision: knowledgeDocuments.revision })
        .from(knowledgeDocuments)
        .where(
          and(
            eq(knowledgeDocuments.organizationId, payload.organizationId),
            eq(knowledgeDocuments.id, payload.documentId),
            eq(knowledgeDocuments.revision, payload.revision),
            eq(knowledgeDocuments.status, "processing")
          )
        )
        .limit(1)
        .for("update")
      if (!current) return

      await transaction
        .delete(knowledgeDocumentChunks)
        .where(
          and(
            eq(knowledgeDocumentChunks.organizationId, payload.organizationId),
            eq(knowledgeDocumentChunks.knowledgeDocumentId, payload.documentId)
          )
        )
      const chunkRows = chunks.map((chunk, ordinal) => {
        const vector = vectors[ordinal]
        if (!vector) throw new Error("Knowledge document embedding is missing")
        return {
          organizationId: payload.organizationId,
          knowledgeDocumentId: payload.documentId,
          ordinal,
          content: chunk,
          embeddingModel: env.AI_EMBEDDING_MODEL,
          embedding: vectorLiteral(vector),
        }
      })
      await transaction.insert(knowledgeDocumentChunks).values(chunkRows)
      await transaction
        .update(knowledgeDocuments)
        .set({
          content: normalizedContent,
          status: "ready",
          failureReason: null,
        })
        .where(
          and(
            eq(knowledgeDocuments.organizationId, payload.organizationId),
            eq(knowledgeDocuments.id, payload.documentId),
            eq(knowledgeDocuments.revision, payload.revision),
            eq(knowledgeDocuments.status, "processing")
          )
        )
    })
  } catch (error) {
    if (job.attemptsMade + 1 >= (job.opts.attempts ?? 1)) {
      await database.db
        .update(knowledgeDocuments)
        .set({ status: "failed", failureReason: "indexing_failed" })
        .where(
          and(
            eq(knowledgeDocuments.organizationId, payload.organizationId),
            eq(knowledgeDocuments.id, payload.documentId),
            eq(knowledgeDocuments.revision, payload.revision),
            eq(knowledgeDocuments.status, "processing")
          )
        )
    }
    throw error
  }
}

async function loadCurrentDocument(input: {
  organizationId: string
  documentId: string
  revision: number
}) {
  const [document] = await database.db
    .select()
    .from(knowledgeDocuments)
    .where(
      and(
        eq(knowledgeDocuments.organizationId, input.organizationId),
        eq(knowledgeDocuments.id, input.documentId)
      )
    )
    .limit(1)
  return document
}

async function extractFileContent(document: typeof knowledgeDocuments.$inferSelect): Promise<string | null> {
  if (
    !document.sourceObjectKey ||
    !document.mimeType ||
    document.sourceSizeBytes === null ||
    document.sourceSizeBytes > maxFileBytes
  ) {
    throw new Error("Knowledge file source metadata is invalid")
  }
  const head = await objectStore.head(document.sourceObjectKey)
  if (
    head.contentType !== document.mimeType ||
    head.contentLength !== document.sourceSizeBytes ||
    !head.contentLength ||
    head.contentLength > maxFileBytes
  ) {
    throw new Error("Knowledge file source metadata drifted")
  }
  const { body } = await objectStore.get(document.sourceObjectKey)
  if (!body) throw new Error("Knowledge file source has no body")
  const bytes = await readAtMost(body, maxFileBytes)

  switch (document.mimeType) {
    case "application/pdf": {
      const pdf = await getDocumentProxy(bytes)
      return (await extractText(pdf, { mergePages: true })).text
    }
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return (await mammoth.extractRawText({ buffer: Buffer.from(bytes) })).value
    case "text/markdown":
    case "text/plain":
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    default:
      throw new Error("Knowledge file content type is unsupported")
  }
}

async function readAtMost(stream: ReadableStream, limit: number): Promise<Uint8Array> {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > limit) throw new Error("Knowledge file exceeds maximum size")
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

function normalizeContent(content: string | null): string {
  return (content ?? "").replaceAll("\r\n", "\n").replaceAll("\0", "").trim()
}

function vectorLiteral(vector: number[]): string {
  if (vector.length !== 1536) throw new Error("Knowledge embedding dimension is invalid")
  return `[${vector.join(",")}]`
}
