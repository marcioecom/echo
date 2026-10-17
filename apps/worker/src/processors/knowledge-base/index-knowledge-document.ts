import { TextDecoder } from "node:util"

import { OpenAIEmbeddings } from "@langchain/openai"
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters"
import {
  runKnowledgeIndexAttempt,
  type IndexableKnowledgeDocument,
  type ServingChunkSet,
} from "@workspace/knowledge"
import { indexKnowledgeDocumentJobSchema } from "@workspace/jobs"
import mammoth from "mammoth"
import type { Job } from "bullmq"
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
  await runKnowledgeIndexAttempt(
    database.db,
    {
      organizationId: payload.organizationId,
      documentId: payload.documentId,
      revision: payload.revision,
      attemptsExhausted: job.attemptsMade + 1 >= (job.opts.attempts ?? 1),
    },
    (document) => buildServingChunkSet(document)
  )
}

async function buildServingChunkSet(
  document: IndexableKnowledgeDocument
): Promise<ServingChunkSet> {
  const raw =
    document.sourceType === "text"
      ? document.content
      : await extractFileContent(document)
  const normalizedContent = normalizeContent(raw)
  if (!normalizedContent) {
    throw new Error("Knowledge document has no readable content")
  }
  const chunks = await splitter.splitText(normalizedContent)
  if (chunks.length === 0) {
    throw new Error("Knowledge document produced no chunks")
  }
  const vectors = await embeddings.embedDocuments(chunks)
  if (vectors.length !== chunks.length) {
    throw new Error("Knowledge document embedding count does not match chunks")
  }
  return {
    organizationId: document.organizationId,
    documentId: document.documentId,
    revision: document.revision,
    sourceType: document.sourceType,
    content: document.sourceType === "file" ? normalizedContent : null,
    chunks: chunks.map((content, ordinal) => {
      const vector = vectors[ordinal]
      if (!vector) throw new Error("Knowledge document embedding is missing")
      return {
        ordinal,
        content,
        embeddingModel: env.AI_EMBEDDING_MODEL,
        embedding: vectorLiteral(vector),
      }
    }),
  }
}

async function extractFileContent(
  document: IndexableKnowledgeDocument
): Promise<string | null> {
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
