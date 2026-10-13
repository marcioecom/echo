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
import { sql } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import type { Redis } from "ioredis"
import { GenericContainer } from "testcontainers"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import type { createApp } from "@/app"

import { knowledgeDocumentChunkPageSize } from "./schemas"

const zeroVector = `[${"0,".repeat(1535)}0]`

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

  let app: ReturnType<typeof createApp>
  let database: ReturnType<typeof createDatabase>
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
    vi.stubEnv("API_HOST", "127.0.0.1")
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
    chunkContents?: string[]
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
    const chunkContents = input.chunkContents ?? []
    if (chunkContents.length > 0) {
      await database.db.insert(knowledgeDocumentChunks).values(
        chunkContents.map((content, ordinal) => ({
          organizationId: input.organizationId,
          knowledgeDocumentId: document.id,
          ordinal,
          content,
          embeddingModel: "test-embedding",
          embedding: zeroVector,
        }))
      )
    }
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

  it("returns metadata, content, and the first page of chunks for the organization", async () => {
    const owner = await ownerContext("kb-detail")
    const other = await ownerContext("kb-other")
    const chunkContents = Array.from(
      { length: knowledgeDocumentChunkPageSize + 1 },
      (_, ordinal) => `trecho ${ordinal} da padaria`
    )
    const document = await insertTextDocument({
      organizationId: owner.organizationId,
      userId: owner.userId,
      title: "Horário da padaria",
      content: "Abrimos de segunda a sábado.",
      chunkContents,
      revision: 4,
    })
    const foreign = await insertTextDocument({
      organizationId: other.organizationId,
      userId: other.userId,
      title: "Segredo da outra loja",
      content: "Conteúdo que não pode vazar.",
      chunkContents: ["trecho secreto da outra loja"],
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
      chunks: {
        items: Array<{
          ordinal: number
          content: string
          characterCount: number
        }>
        page: number
        pageSize: number
        total: number
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
    expect(body.chunks).toMatchObject({
      page: 1,
      pageSize: knowledgeDocumentChunkPageSize,
      total: knowledgeDocumentChunkPageSize + 1,
    })
    expect(body.chunks.items).toHaveLength(knowledgeDocumentChunkPageSize)
    expect(body.chunks.items.map((chunk) => chunk.ordinal)).toEqual(
      Array.from(
        { length: knowledgeDocumentChunkPageSize },
        (_, index) => index
      )
    )
    expect(body.chunks.items[0]).toMatchObject({
      content: "trecho 0 da padaria",
      characterCount: "trecho 0 da padaria".length,
    })
    expect(response.body).not.toContain("Conteúdo que não pode vazar.")
    expect(response.body).not.toContain("trecho secreto da outra loja")
    expect(response.body).not.toContain("sourceObjectKey")
    expect(response.body).not.toContain(zeroVector.slice(0, 12))

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

  it("returns the next page of chunks in ordinal order", async () => {
    const owner = await ownerContext("kb-page")
    const chunkContents = Array.from(
      { length: knowledgeDocumentChunkPageSize + 1 },
      (_, ordinal) => `página ${ordinal}`
    )
    const document = await insertTextDocument({
      organizationId: owner.organizationId,
      userId: owner.userId,
      title: "Cardápio",
      content: "Pão e bolo.",
      chunkContents,
    })

    const response = await app.inject({
      method: "GET",
      url: `/v1/knowledge-documents/${document.id}?page=2`,
      headers: { cookie: owner.cookies },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json() as {
      chunks: {
        items: Array<{ ordinal: number; content: string }>
        page: number
        total: number
      }
    }
    expect(body.chunks.page).toBe(2)
    expect(body.chunks.total).toBe(knowledgeDocumentChunkPageSize + 1)
    expect(body.chunks.items).toEqual([
      expect.objectContaining({
        ordinal: knowledgeDocumentChunkPageSize,
        content: `página ${knowledgeDocumentChunkPageSize}`,
        characterCount: `página ${knowledgeDocumentChunkPageSize}`.length,
      }),
    ])
  })

  it("returns the failure reason and empty chunks for a failed document", async () => {
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
      chunks: { items: [], page: 1, total: 0 },
    })
  })

  it("rejects anonymous users, operators, unknown documents, and invalid pages", async () => {
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
    const invalidPage = await app.inject({
      method: "GET",
      url: `/v1/knowledge-documents/${document.id}?page=0`,
      headers: { cookie: owner.cookies },
    })

    expect(anonymous.statusCode).toBe(401)
    expect(operator.statusCode).toBe(403)
    expect(operator.json()).toEqual({ error: "insufficient_role" })
    expect(operator.body).not.toContain("Texto restrito ao dono.")
    expect(missing.statusCode).toBe(404)
    expect(invalidId.statusCode).toBe(404)
    expect(invalidPage.statusCode).toBe(400)
    expect(invalidPage.json()).toEqual({ error: "invalid_query" })
  })
})
