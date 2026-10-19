import { resolve } from "node:path"

import { PostgreSqlContainer } from "@testcontainers/postgresql"
import type { createDatabase } from "@workspace/db"
import {
  knowledgeDocumentChunks,
  knowledgeDocuments,
} from "@workspace/db/schema"
import {
  createId,
  type KnowledgeDocumentFailureReason,
} from "@workspace/domain"
import type { RetrieveKnowledge } from "@workspace/knowledge"
import { eq, sql } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import type { Redis } from "ioredis"
import { GenericContainer } from "testcontainers"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import type { createApp } from "@/app"
import type * as AgentModule from "@workspace/agent"

type ModelDecision =
  | {
      action: "reply"
      replyType: "answer" | "clarification"
      body: string
    }
  | {
      action: "handoff"
      reason: "human_requested" | "low_confidence" | "unsupported_policy"
      customerMessage: string
      summary: string
    }

const testDoubles = vi.hoisted(() => ({
  enqueue: vi.fn<(jobName: string) => Promise<{ id: string }>>(async () => ({
    id: "job",
  })),
  objectStore: {
    presignPut: vi.fn(),
    head: vi.fn(),
    copy: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(),
  },
  retrieve: null as RetrieveKnowledge | null,
  modelDecision: vi.fn<() => ModelDecision>(() => ({
    action: "reply",
    replyType: "answer",
    body: "Abrimos de terça a sábado.",
  })),
}))

vi.mock("@/lib/jobs-client", () => ({
  jobs: {
    enqueue: testDoubles.enqueue,
    close: vi.fn(),
  },
}))

vi.mock("@/lib/object-store", () => ({
  objectStore: testDoubles.objectStore,
}))
vi.mock("@workspace/agent", async (importOriginal) => {
  const actual = await importOriginal<typeof AgentModule>()
  return {
    ...actual,
    createSupportAgentModel: () => ({
      withStructuredOutput: () => ({
        invoke: async () => testDoubles.modelDecision(),
      }),
    }),
  }
})

vi.mock("./embedder", () => ({
  retrieveKnowledge: null,
  getRetrieveKnowledge: () => (input: Parameters<RetrieveKnowledge>[0]) => {
    if (!testDoubles.retrieve) {
      throw new Error("Test retrieve knowledge is not configured")
    }
    return testDoubles.retrieve(input)
  },
}))

function extractCookies(
  headers: Record<string, string | string[] | number | undefined>
): string {
  const raw = headers["set-cookie"]
  const setCookies = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? [raw]
      : undefined
  if (!setCookies) return ""
  return setCookies.map((cookie) => cookie.split(";")[0]).join("; ")
}

describe("knowledge document detail API", () => {
  const postgresContainer = new PostgreSqlContainer("pgvector/pgvector:pg18")
  const redisContainer = new GenericContainer(
    "redis:7.4-alpine"
  ).withExposedPorts(6379)

  const testEmbedding = [1, ...Array.from({ length: 1535 }, () => 0)]
  const testEmbeddingLiteral = `[${testEmbedding.join(",")}]`
  let app: ReturnType<typeof createApp>
  let database: ReturnType<typeof createDatabase>
  let retrieve: RetrieveKnowledge
  let redis: Redis
  let stopPostgres: () => Promise<void>
  let stopRedis: () => Promise<void>
  let sequence = 0

  beforeAll(async () => {
    const [postgres, redisService] = await Promise.all([
      postgresContainer.start(),
      redisContainer.start(),
    ])
    stopPostgres = () => postgres.stop().then(() => undefined)
    stopRedis = () => redisService.stop().then(() => undefined)

    vi.stubEnv("DATABASE_URL", postgres.getConnectionUri())
    vi.stubEnv(
      "REDIS_URL",
      `redis://${redisService.getHost()}:${redisService.getMappedPort(6379)}`
    )
    vi.stubEnv("DEPENDENCY_TIMEOUT_MS", "10000")
    vi.stubEnv("AI_GATEWAY_API_KEY", "integration-gateway-key")
    vi.stubEnv("AI_CHAT_MODEL", "openai/gpt-5.6-luna")
    vi.stubEnv("API_PORT", "3001")
    vi.stubEnv("NODE_ENV", "test")
    vi.stubEnv("LOG_LEVEL", "silent")
    vi.stubEnv("BETTER_AUTH_SECRET", "integration-test-secret-integration-test")
    vi.stubEnv(
      "CHANNEL_CREDENTIALS_ENCRYPTION_KEY",
      Buffer.alloc(32, 1).toString("base64")
    )
    vi.stubEnv("CHANNEL_CREDENTIALS_KEY_VERSION", "v1")
    vi.stubEnv("PUBLIC_API_URL", "http://localhost:3001")
    vi.stubEnv("WEB_APP_URL", "http://localhost:3000")
    vi.stubEnv("EMAIL_ASSET_BASE_URL", "https://assets.echo.test")
    vi.stubEnv("R2_ENDPOINT", "https://r2.echo.test")
    vi.stubEnv("R2_BUCKET_NAME", "echo-storage")
    vi.stubEnv("R2_ACCESS_KEY_ID", "test-access-key")
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "test-secret-key")
    vi.stubEnv(
      "KNOWLEDGE_UPLOAD_TOKEN_SECRET",
      "knowledge-upload-token-secret-at-least-32"
    )

    vi.resetModules()
    const [appModule, dbModule, redisModule] = await Promise.all([
      import("../../app"),
      import("../../lib/db"),
      import("../../lib/redis"),
    ])
    app = appModule.createApp()
    database = dbModule.database
    redis = redisModule.redisConnection
    await database.db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`)
    await migrate(database.db, {
      migrationsFolder: resolve(process.cwd(), "../../packages/db/migrations"),
    })
    const knowledge = await import("@workspace/knowledge")
    retrieve = knowledge.createRetrieveKnowledge({
      database: database.db,
      embedQuery: async () => testEmbedding,
    })
    testDoubles.retrieve = retrieve
    testDoubles.enqueue.mockResolvedValue({ id: "job" })
    testDoubles.objectStore.copy.mockResolvedValue(undefined)
    testDoubles.objectStore.delete.mockResolvedValue(undefined)
  }, 120_000)

  afterAll(async () => {
    await Promise.allSettled([
      app?.close(),
      database?.close(),
      redis?.quit(),
      stopPostgres?.(),
      stopRedis?.(),
    ])
    vi.unstubAllEnvs()
  })

  function nextId(prefix: string) {
    sequence += 1
    return `${prefix}-${sequence}`
  }

  async function signUp(email: string, name: string): Promise<string> {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      payload: { email, name, password: "password123" },
    })
    expect(response.statusCode).toBe(200)
    return extractCookies(response.headers)
  }

  async function createOrganization(cookies: string, name: string) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-")
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/organization/create",
      headers: { cookie: cookies },
      payload: { name, slug },
    })
    expect(response.statusCode).toBe(200)
    return response.json() as { id: string }
  }

  async function sessionUserId(cookies: string): Promise<string> {
    const response = await app.inject({
      method: "GET",
      url: "/api/auth/get-session",
      headers: { cookie: cookies },
    })
    expect(response.statusCode).toBe(200)
    return (response.json() as { user: { id: string } }).user.id
  }

  async function ownerContext(label: string) {
    const id = nextId(label)
    const cookies = await signUp(`${id}@example.com`, id)
    const organization = await createOrganization(cookies, id)
    const userId = await sessionUserId(cookies)
    return { cookies, organizationId: organization.id, userId }
  }

  async function insertTextDocument(input: {
    organizationId: string
    userId: string
    title: string
    content: string
    status?: "pending" | "processing" | "ready" | "failed"
    failureReason?: KnowledgeDocumentFailureReason | null
    revision?: number
  }) {
    const [document] = await database.db
      .insert(knowledgeDocuments)
      .values({
        organizationId: input.organizationId,
        createdByUserId: input.userId,
        title: input.title,
        sourceType: "text",
        content: input.content,
        status: input.status ?? "ready",
        failureReason: input.failureReason ?? null,
        revision: input.revision ?? 1,
      })
      .returning()
    if (!document) throw new Error("Knowledge document insert returned no row")
    return document
  }

  async function insertFailedFile(input: {
    organizationId: string
    userId: string
    title: string
    failureReason: KnowledgeDocumentFailureReason
  }) {
    const [document] = await database.db
      .insert(knowledgeDocuments)
      .values({
        organizationId: input.organizationId,
        createdByUserId: input.userId,
        title: input.title,
        sourceType: "file",
        sourceName: "scan.pdf",
        mimeType: "application/pdf",
        sourceObjectKey: `knowledge/documents/${input.organizationId}/${createId()}/scan.pdf`,
        sourceObjectEtag: "etag",
        sourceSizeBytes: 1200,
        status: "failed",
        failureReason: input.failureReason,
      })
      .returning()
    if (!document) throw new Error("Knowledge file insert returned no row")
    return document
  }

  async function insertChunk(input: {
    organizationId: string
    documentId: string
    content: string
    ordinal?: number
  }) {
    await database.db.insert(knowledgeDocumentChunks).values({
      organizationId: input.organizationId,
      knowledgeDocumentId: input.documentId,
      ordinal: input.ordinal ?? 0,
      content: input.content,
      embeddingModel: "openai/text-embedding-3-small",
      embedding: testEmbeddingLiteral,
    })
  }

  it("returns metadata and extracted content for the organization", async () => {
    const owner = await ownerContext("kb-detail")
    const other = await ownerContext("kb-other")
    const document = await insertTextDocument({
      organizationId: owner.organizationId,
      userId: owner.userId,
      title: "Horário da padaria",
      content: "Abrimos de segunda a sábado.",
      revision: 4,
    })
    const foreign = await insertTextDocument({
      organizationId: other.organizationId,
      userId: other.userId,
      title: "Segredo da outra loja",
      content: "Conteúdo que não pode vazar.",
    })

    const response = await app.inject({
      method: "GET",
      url: `/v1/knowledge-documents/${document.id}`,
      headers: { cookie: owner.cookies },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json() as {
      document: {
        id: string
        title: string
        content: string
        status: string
        failureReason: string | null
        revision: number
        sourceType: string
      }
    }
    expect(body.document).toMatchObject({
      id: document.id,
      title: "Horário da padaria",
      content: "Abrimos de segunda a sábado.",
      status: "ready",
      failureReason: null,
      revision: 4,
      sourceType: "text",
    })
    expect(body).not.toHaveProperty("chunks")
    expect(response.body).not.toContain("Conteúdo que não pode vazar.")
    expect(response.body).not.toContain("sourceObjectKey")

    const leaked = await app.inject({
      method: "GET",
      url: `/v1/knowledge-documents/${document.id}`,
      headers: { cookie: other.cookies },
    })
    expect(leaked.statusCode).toBe(404)
    expect(leaked.json()).toEqual({ error: "knowledge_document_not_found" })
    expect(leaked.body).not.toContain("Abrimos de segunda a sábado.")

    const hiddenForeign = await app.inject({
      method: "GET",
      url: `/v1/knowledge-documents/${foreign.id}`,
      headers: { cookie: owner.cookies },
    })
    expect(hiddenForeign.statusCode).toBe(404)
  })

  it("returns the failure reason for a failed document", async () => {
    const owner = await ownerContext("kb-failed")
    const document = await insertFailedFile({
      organizationId: owner.organizationId,
      userId: owner.userId,
      title: "PDF escaneado",
      failureReason: "no_text_extracted",
    })

    const response = await app.inject({
      method: "GET",
      url: `/v1/knowledge-documents/${document.id}`,
      headers: { cookie: owner.cookies },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      document: {
        id: document.id,
        title: "PDF escaneado",
        sourceType: "file",
        sourceName: "scan.pdf",
        content: null,
        status: "failed",
        failureReason: "no_text_extracted",
      },
    })
    expect(response.json()).not.toHaveProperty("chunks")
  })

  it("rejects anonymous users, operators, and unknown documents", async () => {
    const owner = await ownerContext("kb-auth")
    const document = await insertTextDocument({
      organizationId: owner.organizationId,
      userId: owner.userId,
      title: "Política interna",
      content: "Texto restrito ao dono.",
    })
    const invite = await app.inject({
      method: "POST",
      url: "/api/auth/organization/invite-member",
      headers: { cookie: owner.cookies },
      payload: { email: "kb-operator@example.com", role: "operator" },
    })
    expect(invite.statusCode).toBe(200)
    const invitation = invite.json() as { id: string }
    const operatorCookies = await signUp("kb-operator@example.com", "Operator")
    const accept = await app.inject({
      method: "POST",
      url: "/api/auth/organization/accept-invitation",
      headers: { cookie: operatorCookies },
      payload: { invitationId: invitation.id },
    })
    expect(accept.statusCode).toBe(200)
    const activated = await app.inject({
      method: "POST",
      url: "/api/auth/organization/set-active",
      headers: { cookie: operatorCookies },
      payload: { organizationId: owner.organizationId },
    })
    expect(activated.statusCode).toBe(200)

    const anonymous = await app.inject({
      method: "GET",
      url: `/v1/knowledge-documents/${document.id}`,
    })
    const operator = await app.inject({
      method: "GET",
      url: `/v1/knowledge-documents/${document.id}`,
      headers: { cookie: operatorCookies },
    })
    const missing = await app.inject({
      method: "GET",
      url: "/v1/knowledge-documents/01K1EDN69NFBWCG42B2H99V2C4",
      headers: { cookie: owner.cookies },
    })
    const invalidId = await app.inject({
      method: "GET",
      url: "/v1/knowledge-documents/not-a-document",
      headers: { cookie: owner.cookies },
    })

    expect(anonymous.statusCode).toBe(401)
    expect(operator.statusCode).toBe(403)
    expect(operator.json()).toEqual({ error: "insufficient_role" })
    expect(operator.body).not.toContain("Texto restrito ao dono.")
    expect(missing.statusCode).toBe(404)
    expect(invalidId.statusCode).toBe(400)
    expect(invalidId.json()).toEqual({ error: "invalid_request" })
  })

  it("retrieves a pending document with chunks and hides a deleted document", async () => {
    const owner = await ownerContext("kb-retrieve")
    const other = await ownerContext("kb-retrieve-other")
    const pending = await insertTextDocument({
      organizationId: owner.organizationId,
      userId: owner.userId,
      title: "Horário da padaria",
      content: "Texto novo ainda não publicado.",
      status: "pending",
      revision: 2,
    })
    const removed = await insertTextDocument({
      organizationId: owner.organizationId,
      userId: owner.userId,
      title: "Documento apagado",
      content: "Não deve voltar.",
    })
    const foreign = await insertTextDocument({
      organizationId: other.organizationId,
      userId: other.userId,
      title: "Segredo da outra loja",
      content: "Conteúdo de outro tenant.",
    })
    await insertChunk({
      organizationId: owner.organizationId,
      documentId: pending.id,
      content: "Abrimos de terça a sábado.",
    })
    await insertChunk({
      organizationId: owner.organizationId,
      documentId: removed.id,
      content: "Texto de um documento apagado.",
    })
    await insertChunk({
      organizationId: other.organizationId,
      documentId: foreign.id,
      content: "Texto de outra organização.",
    })
    await database.db
      .update(knowledgeDocuments)
      .set({ deletedAt: new Date() })
      .where(eq(knowledgeDocuments.id, removed.id))

    const snippets = await retrieve({
      organizationId: owner.organizationId,
      query: "horário",
      limit: 6,
    })

    expect(snippets.map((snippet) => snippet.documentId)).toEqual([pending.id])
    expect(snippets[0]?.content).toBe("Abrimos de terça a sábado.")
    expect(snippets[0]?.documentTitle).toBe("Horário da padaria")
  })

  it("deletes a document and then retrieves no chunk for it", async () => {
    const owner = await ownerContext("kb-delete")
    const other = await ownerContext("kb-delete-other")
    const [document] = await database.db
      .insert(knowledgeDocuments)
      .values({
        organizationId: owner.organizationId,
        createdByUserId: owner.userId,
        title: "Política antiga",
        sourceType: "file",
        sourceName: "politica.txt",
        mimeType: "text/plain",
        sourceObjectKey: `knowledge/documents/${owner.organizationId}/${createId()}/politica.txt`,
        sourceObjectEtag: "etag",
        sourceSizeBytes: 24,
        status: "ready",
        content: "Texto que sai do índice.",
      })
      .returning()
    if (!document)
      throw new Error("Knowledge delete fixture insert returned no row")
    const foreign = await insertTextDocument({
      organizationId: other.organizationId,
      userId: other.userId,
      title: "Política vizinha",
      content: "Fica na outra organização.",
    })
    await insertChunk({
      organizationId: owner.organizationId,
      documentId: document.id,
      content: "Texto que sai do índice.",
    })
    await insertChunk({
      organizationId: other.organizationId,
      documentId: foreign.id,
      content: "Fica na outra organização.",
    })
    testDoubles.enqueue.mockClear()

    const deleted = await app.inject({
      method: "DELETE",
      url: `/v1/knowledge-documents/${document.id}`,
      headers: { cookie: owner.cookies },
    })
    const snippets = await retrieve({
      organizationId: owner.organizationId,
      query: "política",
      limit: 6,
    })
    const list = await app.inject({
      method: "GET",
      url: "/v1/knowledge-documents",
      headers: { cookie: owner.cookies },
    })
    const detail = await app.inject({
      method: "GET",
      url: `/v1/knowledge-documents/${document.id}`,
      headers: { cookie: owner.cookies },
    })
    const again = await app.inject({
      method: "DELETE",
      url: `/v1/knowledge-documents/${document.id}`,
      headers: { cookie: owner.cookies },
    })
    const missing = await app.inject({
      method: "DELETE",
      url: "/v1/knowledge-documents/01K1EDN69NFBWCG42B2H99V2C4",
      headers: { cookie: owner.cookies },
    })
    const [row] = await database.db
      .select({ deletedAt: knowledgeDocuments.deletedAt })
      .from(knowledgeDocuments)
      .where(eq(knowledgeDocuments.id, document.id))

    expect(deleted.statusCode).toBe(204)
    expect(deleted.body).toBe("")
    expect(snippets).toEqual([])
    expect(list.json()).toEqual({ items: [] })
    expect(detail.statusCode).toBe(404)
    expect(again.statusCode).toBe(204)
    expect(missing.statusCode).toBe(404)
    expect(missing.json()).toEqual({ error: "knowledge_document_not_found" })
    expect(row?.deletedAt).toBeInstanceOf(Date)
    expect(testDoubles.enqueue).toHaveBeenCalledWith(
      "delete-knowledge-object",
      expect.objectContaining({
        deletionId: expect.stringMatching(/^[0-9A-HJKMNP-TV-Z]{26}$/),
      })
    )
    const stored = await retrieve({
      organizationId: other.organizationId,
      query: "política",
      limit: 6,
    })
    expect(stored.map((snippet) => snippet.documentId)).toEqual([foreign.id])
  })

  it("patches text without hiding the stored chunk", async () => {
    const owner = await ownerContext("kb-patch")
    const document = await insertTextDocument({
      organizationId: owner.organizationId,
      userId: owner.userId,
      title: "Horário da padaria",
      content: "Abrimos de terça a sábado.",
      status: "ready",
      revision: 4,
    })
    const file = await insertFailedFile({
      organizationId: owner.organizationId,
      userId: owner.userId,
      title: "Arquivo",
      failureReason: "indexing_failed",
    })
    await insertChunk({
      organizationId: owner.organizationId,
      documentId: document.id,
      content: "Abrimos de terça a sábado.",
    })
    testDoubles.enqueue.mockClear()

    const titleOnly = await app.inject({
      method: "PATCH",
      url: `/v1/knowledge-documents/${document.id}`,
      headers: { cookie: owner.cookies },
      payload: { title: "Horário novo" },
    })
    const afterTitle = await retrieve({
      organizationId: owner.organizationId,
      query: "horário",
      limit: 6,
    })

    expect(titleOnly.statusCode).toBe(200)
    expect(titleOnly.json()).toMatchObject({
      document: {
        id: document.id,
        title: "Horário novo",
        status: "ready",
        failureReason: null,
        revision: 4,
      },
    })
    expect(testDoubles.enqueue).not.toHaveBeenCalled()
    expect(afterTitle.map((snippet) => snippet.content)).toEqual([
      "Abrimos de terça a sábado.",
    ])
    expect(afterTitle[0]?.documentTitle).toBe("Horário novo")

    const changed = await app.inject({
      method: "PATCH",
      url: `/v1/knowledge-documents/${document.id}`,
      headers: { cookie: owner.cookies },
      payload: {
        title: "Horário novo",
        content: "Abrimos de terça a sábado, das 8h às 18h.",
      },
    })
    const afterContent = await retrieve({
      organizationId: owner.organizationId,
      query: "horário",
      limit: 6,
    })
    expect(changed.statusCode).toBe(200)
    expect(changed.json()).toMatchObject({
      document: {
        id: document.id,
        status: "pending",
        failureReason: null,
        revision: 5,
      },
    })
    expect(afterContent.map((snippet) => snippet.content)).toEqual([
      "Abrimos de terça a sábado.",
    ])
    const detail = await app.inject({
      method: "GET",
      url: `/v1/knowledge-documents/${document.id}`,
      headers: { cookie: owner.cookies },
    })
    expect(detail.json()).toMatchObject({ previousVersionActive: true })

    const sameBytes = await app.inject({
      method: "PATCH",
      url: `/v1/knowledge-documents/${document.id}`,
      headers: { cookie: owner.cookies },
      payload: {
        title: "Horário novo",
        content: "Abrimos de terça a sábado, das 8h às 18h.",
      },
    })
    expect(sameBytes.json()).toMatchObject({
      document: { revision: 5, status: "pending" },
    })

    const failedText = await insertTextDocument({
      organizationId: owner.organizationId,
      userId: owner.userId,
      title: "Cardápio",
      content: "Pão e café.",
      status: "failed",
      failureReason: "indexing_failed",
      revision: 2,
    })
    const failedReplay = await app.inject({
      method: "PATCH",
      url: `/v1/knowledge-documents/${failedText.id}`,
      headers: { cookie: owner.cookies },
      payload: { title: "Cardápio", content: "Pão e café." },
    })
    expect(failedReplay.statusCode).toBe(200)
    expect(failedReplay.json()).toMatchObject({
      document: {
        revision: 2,
        status: "failed",
        failureReason: "indexing_failed",
      },
    })

    const fileTitlePatch = await app.inject({
      method: "PATCH",
      url: `/v1/knowledge-documents/${file.id}`,
      headers: { cookie: owner.cookies },
      payload: { title: "Outro nome" },
    })
    expect(fileTitlePatch.statusCode).toBe(200)
    expect(fileTitlePatch.json()).toMatchObject({
      document: {
        title: "Outro nome",
        revision: file.revision,
        status: file.status,
      },
    })

    const fileContentPatch = await app.inject({
      method: "PATCH",
      url: `/v1/knowledge-documents/${file.id}`,
      headers: { cookie: owner.cookies },
      payload: { title: "Outro nome", content: "Texto" },
    })
    expect(fileContentPatch.statusCode).toBe(409)
    expect(fileContentPatch.json()).toEqual({
      error: "knowledge_document_not_text",
    })
    const { createKnowledgeUploadToken } = await import("./upload-token")
    const textUploadToken = createKnowledgeUploadToken({
      uploadId: createId(),
      organizationId: owner.organizationId,
      createdByUserId: owner.userId,
      fileName: "nota.txt",
      contentType: "text/plain",
      sizeBytes: 4,
      objectKey: `knowledge/documents/${owner.organizationId}/${createId()}/nota.txt`,
      expiresAt: Date.now() + 60_000,
    })
    const textFileReplace = await app.inject({
      method: "PUT",
      url: `/v1/knowledge-documents/${document.id}/file`,
      headers: { cookie: owner.cookies },
      payload: { uploadToken: textUploadToken },
    })
    expect(textFileReplace.statusCode).toBe(409)
    expect(textFileReplace.json()).toEqual({
      error: "knowledge_document_not_file",
    })

    const rejected = await app.inject({
      method: "PATCH",
      url: `/v1/knowledge-documents/${document.id}`,
      headers: { cookie: owner.cookies },
      payload: { title: "Horário novo", organizationId: owner.organizationId },
    })
    expect(rejected.statusCode).toBe(400)
    expect(rejected.json()).toEqual({ error: "invalid_request" })
  })

  it("keeps the previous chunk when index dispatch fails after a content edit", async () => {
    const owner = await ownerContext("kb-dispatch")
    const document = await insertTextDocument({
      organizationId: owner.organizationId,
      userId: owner.userId,
      title: "Entrega",
      content: "Entregamos no mesmo bairro.",
      status: "ready",
      revision: 2,
    })
    await insertChunk({
      organizationId: owner.organizationId,
      documentId: document.id,
      content: "Entregamos no mesmo bairro.",
    })
    testDoubles.enqueue.mockImplementation(async (name: string) => {
      if (name === "index-knowledge-document") throw new Error("queue down")
      return { id: "job" }
    })

    const response = await app.inject({
      method: "PATCH",
      url: `/v1/knowledge-documents/${document.id}`,
      headers: { cookie: owner.cookies },
      payload: { content: "Entregamos na cidade toda." },
    })
    const [row] = await database.db
      .select({
        status: knowledgeDocuments.status,
        failureReason: knowledgeDocuments.failureReason,
        revision: knowledgeDocuments.revision,
      })
      .from(knowledgeDocuments)
      .where(eq(knowledgeDocuments.id, document.id))
    const snippets = await retrieve({
      organizationId: owner.organizationId,
      query: "entrega",
      limit: 6,
    })
    testDoubles.enqueue.mockResolvedValue({ id: "job" })

    expect(response.statusCode).toBe(503)
    expect(response.json()).toEqual({
      error: "knowledge_index_dispatch_unavailable",
      documentId: document.id,
    })
    expect(row).toMatchObject({
      status: "failed",
      failureReason: "index_dispatch_failed",
      revision: 3,
    })
    expect(snippets.map((snippet) => snippet.content)).toEqual([
      "Entregamos no mesmo bairro.",
    ])
  })

  it("replaces a file without changing the document id or dropping the stored chunk", async () => {
    const owner = await ownerContext("kb-replace")
    const uploadId = createId()
    const document = await insertTextDocument({
      organizationId: owner.organizationId,
      userId: owner.userId,
      title: "Manual",
      content: "ignored",
    })
    await database.db
      .delete(knowledgeDocuments)
      .where(eq(knowledgeDocuments.id, document.id))
    const [file] = await database.db
      .insert(knowledgeDocuments)
      .values({
        id: document.id,
        organizationId: owner.organizationId,
        createdByUserId: owner.userId,
        title: "Manual",
        sourceType: "file",
        sourceName: "manual.txt",
        mimeType: "text/plain",
        sourceObjectKey: `knowledge/documents/${owner.organizationId}/${document.id}/old.txt`,
        sourceObjectEtag: "etag-old",
        sourceSizeBytes: 10,
        status: "ready",
        revision: 3,
      })
      .returning()
    if (!file) throw new Error("Knowledge file fixture insert returned no row")
    await insertChunk({
      organizationId: owner.organizationId,
      documentId: file.id,
      content: "Texto da versão anterior.",
    })
    const { createKnowledgeUploadToken } = await import("./upload-token")
    const uploadToken = createKnowledgeUploadToken({
      uploadId,
      organizationId: owner.organizationId,
      createdByUserId: owner.userId,
      fileName: "horario.txt",
      contentType: "text/plain",
      sizeBytes: 12,
      objectKey: `knowledge/documents/${owner.organizationId}/${uploadId}/horario.txt`,
      expiresAt: Date.now() + 60_000,
    })
    testDoubles.objectStore.head.mockResolvedValue({
      contentType: "text/plain",
      contentLength: 12,
      etag: "etag-new",
    })
    testDoubles.objectStore.copy.mockClear()
    testDoubles.enqueue.mockClear()

    const replaced = await app.inject({
      method: "PUT",
      url: `/v1/knowledge-documents/${file.id}/file`,
      headers: { cookie: owner.cookies },
      payload: { uploadToken },
    })
    const snippets = await retrieve({
      organizationId: owner.organizationId,
      query: "horário",
      limit: 6,
    })
    const replay = await app.inject({
      method: "PUT",
      url: `/v1/knowledge-documents/${file.id}/file`,
      headers: { cookie: owner.cookies },
      payload: { uploadToken },
    })
    const [stored] = await database.db
      .select({
        revision: knowledgeDocuments.revision,
        sourceObjectKey: knowledgeDocuments.sourceObjectKey,
      })
      .from(knowledgeDocuments)
      .where(eq(knowledgeDocuments.id, file.id))

    expect(replaced.statusCode).toBe(200)
    expect(replaced.json()).toMatchObject({
      document: {
        id: file.id,
        sourceType: "file",
        sourceName: "horario.txt",
        status: "pending",
        failureReason: null,
        revision: 4,
      },
    })
    expect(replaced.json().document.id).not.toBe(uploadId)
    expect(snippets.map((snippet) => snippet.content)).toEqual([
      "Texto da versão anterior.",
    ])
    expect(replay.statusCode).toBe(200)
    expect(replay.json()).toMatchObject({
      document: { id: file.id, revision: 4 },
    })
    expect(stored?.revision).toBe(4)
    expect(stored?.sourceObjectKey).toBe(
      `knowledge/documents/${owner.organizationId}/${uploadId}/horario.txt`
    )
    expect(testDoubles.enqueue).toHaveBeenCalledWith(
      "delete-knowledge-object",
      expect.objectContaining({
        deletionId: expect.stringMatching(/^[0-9A-HJKMNP-TV-Z]{26}$/),
      })
    )
    expect(testDoubles.objectStore.copy).not.toHaveBeenCalled()
  })

  it("does not bump revision when a failed file replace is replayed", async () => {
    const owner = await ownerContext("kb-replay")
    const uploadId = createId()
    const documentId = createId()
    const permanentKey = `knowledge/documents/${owner.organizationId}/${documentId}/${uploadId}/horario.txt`
    await database.db.insert(knowledgeDocuments).values({
      id: documentId,
      organizationId: owner.organizationId,
      createdByUserId: owner.userId,
      title: "Horário",
      sourceType: "file",
      sourceName: "horario.txt",
      mimeType: "text/plain",
      sourceObjectKey: permanentKey,
      sourceObjectEtag: "etag-new",
      sourceSizeBytes: 12,
      status: "failed",
      failureReason: "indexing_failed",
      revision: 4,
    })
    const { createKnowledgeUploadToken } = await import("./upload-token")
    const uploadToken = createKnowledgeUploadToken({
      uploadId,
      organizationId: owner.organizationId,
      createdByUserId: owner.userId,
      fileName: "horario.txt",
      contentType: "text/plain",
      sizeBytes: 12,
      objectKey: permanentKey,
      expiresAt: Date.now() + 60_000,
    })
    testDoubles.objectStore.copy.mockClear()
    testDoubles.enqueue.mockClear()

    const response = await app.inject({
      method: "PUT",
      url: `/v1/knowledge-documents/${documentId}/file`,
      headers: { cookie: owner.cookies },
      payload: { uploadToken },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      document: {
        id: documentId,
        revision: 4,
        status: "failed",
        failureReason: "indexing_failed",
      },
    })
    expect(testDoubles.objectStore.copy).not.toHaveBeenCalled()
    expect(testDoubles.enqueue).not.toHaveBeenCalledWith(
      "index-knowledge-document",
      expect.anything()
    )
  })

  it("presigns the permanent object key at upload creation and confirms without copying", async () => {
    const owner = await ownerContext("kb-upload")
    testDoubles.objectStore.presignPut.mockResolvedValue({
      url: "https://r2.echo.test/upload",
      headers: { "Content-Type": "text/plain" },
    })

    const created = await app.inject({
      method: "POST",
      url: "/v1/knowledge-document-uploads",
      headers: { cookie: owner.cookies },
      payload: { fileName: "horario.txt", contentType: "text/plain", sizeBytes: 12 },
    })
    const upload = created.json() as {
      uploadUrl: string
      uploadToken: string
      expiresAt: string
      headers: { "Content-Type": string }
    }
    const presigned = testDoubles.objectStore.presignPut.mock.calls.at(-1)?.[0]
    const objectKeyPattern = new RegExp(
      `^knowledge/documents/${owner.organizationId}/[0-9A-HJKMNP-TV-Z]{26}/horario\\.txt$`
    )

    expect(created.statusCode, created.body).toBe(201)
    expect(upload.uploadUrl).toBe("https://r2.echo.test/upload")
    expect(upload.headers).toEqual({ "Content-Type": "text/plain" })
    expect(new Date(upload.expiresAt).getTime()).toBeGreaterThan(Date.now())
    expect(presigned).toMatchObject({
      contentType: "text/plain",
      expiresIn: 900,
    })
    expect(presigned?.key).toMatch(objectKeyPattern)
    expect(presigned?.key).not.toContain("knowledge/uploads/")

    const { verifyKnowledgeUploadToken } = await import("./upload-token")
    const payload = verifyKnowledgeUploadToken(upload.uploadToken)
    expect(payload?.objectKey).toBe(presigned?.key)
    expect(payload?.organizationId).toBe(owner.organizationId)
    expect(payload?.createdByUserId).toBe(owner.userId)

    testDoubles.objectStore.head.mockResolvedValue({
      contentType: "text/plain",
      contentLength: 12,
      etag: "etag-upload",
    })
    testDoubles.objectStore.copy.mockClear()
    testDoubles.enqueue.mockClear()

    const confirmed = await app.inject({
      method: "POST",
      url: "/v1/knowledge-documents/file",
      headers: { cookie: owner.cookies },
      payload: { title: "Horário", uploadToken: upload.uploadToken },
    })
    const [stored] = await database.db
      .select({
        sourceObjectKey: knowledgeDocuments.sourceObjectKey,
        sourceObjectEtag: knowledgeDocuments.sourceObjectEtag,
      })
      .from(knowledgeDocuments)
      .where(eq(knowledgeDocuments.id, payload?.uploadId ?? ""))

    expect(confirmed.statusCode, confirmed.body).toBe(201)
    expect(confirmed.json()).toMatchObject({
      document: {
        id: payload?.uploadId,
        title: "Horário",
        sourceType: "file",
        sourceName: "horario.txt",
        mimeType: "text/plain",
        sourceSizeBytes: 12,
        status: "pending",
      },
    })
    expect(stored?.sourceObjectKey).toBe(presigned?.key)
    expect(stored?.sourceObjectEtag).toBe("etag-upload")
    expect(testDoubles.objectStore.copy).not.toHaveBeenCalled()
    expect(testDoubles.enqueue).toHaveBeenCalledWith(
      "index-knowledge-document",
      expect.objectContaining({ documentId: payload?.uploadId })
    )
  })

  it("returns the support graph decision and tenant-scoped retrieval evidence without side effects", async () => {
    const owner = await ownerContext("kb-preview")
    const other = await ownerContext("kb-preview-other")
    const document = await insertTextDocument({
      organizationId: owner.organizationId,
      userId: owner.userId,
      title: "Horário da padaria",
      content: "Abrimos de terça a sábado.",
    })
    const foreign = await insertTextDocument({
      organizationId: other.organizationId,
      userId: other.userId,
      title: "Segredo da outra loja",
      content: "Texto de outra organização.",
    })
    await insertChunk({
      organizationId: owner.organizationId,
      documentId: document.id,
      content: "Abrimos de terça a sábado.",
    })
    await insertChunk({
      organizationId: other.organizationId,
      documentId: foreign.id,
      content: "Texto de outra organização.",
    })

    const enqueueCallCount = testDoubles.enqueue.mock.calls.length
    const response = await app.inject({
      method: "POST",
      url: "/v1/knowledge-base/preview-response",
      headers: { cookie: owner.cookies },
      payload: { question: "Que horas a padaria abre?" },
    })
    const body = response.json() as {
      decision: Record<string, unknown>
      hits: Array<Record<string, unknown>>
    }

    expect(response.statusCode, response.body).toBe(200)
    expect(body.decision).toEqual({
      action: "reply",
      replyType: "answer",
      body: "Abrimos de terça a sábado.",
    })
    expect(body.hits).toEqual([
      expect.objectContaining({
        documentId: document.id,
        title: "Horário da padaria",
        excerpt: "Abrimos de terça a sábado.",
      }),
    ])
    expect(response.body).not.toContain("Segredo da outra loja")
    expect(testDoubles.enqueue).toHaveBeenCalledTimes(enqueueCallCount)

    testDoubles.modelDecision.mockImplementation(() => ({
      action: "handoff",
      reason: "low_confidence",
      customerMessage: "Vou chamar alguém da equipe.",
      summary: "A pergunta precisa de atendimento humano.",
    }))
    const handoff = await app.inject({
      method: "POST",
      url: "/v1/knowledge-base/preview-response",
      headers: { cookie: owner.cookies },
      payload: { question: "Preciso falar com uma pessoa." },
    })
    expect(handoff.statusCode, handoff.body).toBe(200)

    const invalid = await app.inject({
      method: "POST",
      url: "/v1/knowledge-base/preview-response",
      headers: { cookie: owner.cookies },
      payload: { question: "   ", organizationId: other.organizationId },
    })
    expect(invalid.statusCode).toBe(400)
    expect(invalid.json()).toEqual({ error: "invalid_request" })
  })
})
