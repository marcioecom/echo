import type { TranscribeInboundAudioDependencies } from "./transcribe-inbound-audio"
import type { ChannelProvider } from "@workspace/domain"
import type { Job } from "bullmq"

import { resolve } from "node:path"

import { PostgreSqlContainer } from "@testcontainers/postgresql"
import { createDatabase } from "@workspace/db"
import {
  auditEvents,
  channelConnectionProviderBindings,
  channelConnections,
  channelIdentities,
  contacts,
  messageMedia,
  messages,
  organizations,
  supportConversations,
} from "@workspace/db/schema"
import { createId } from "@workspace/domain"
import { and, eq, sql } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

import { TranscriptionError } from "../../lib/transcription"
import { supportConversationsQueue } from "../../queues/support-conversations"
import { transcribeInboundAudio } from "./transcribe-inbound-audio"

const { databaseRef, publish, get } = vi.hoisted(() => ({
  databaseRef: { current: {} as object },
  publish: vi.fn(),
  get: vi.fn(),
}))

vi.mock("../../lib/db", () => ({
  database: new Proxy(
    {},
    {
      get: (_target, property) => Reflect.get(databaseRef.current, property),
    }
  ),
}))
vi.mock("../../config/env", () => ({
  env: {
    PUBLIC_API_URL: "https://api.example.test",
    CHANNEL_CREDENTIALS_ENCRYPTION_KEY: Buffer.alloc(32, 3).toString("base64"),
    CHANNEL_CREDENTIALS_KEY_VERSION: "v1",
    AI_GATEWAY_API_KEY: "test-key",
    AI_TRANSCRIPTION_MODEL: "openai/gpt-4o-mini-transcribe",
    AI_TRANSCRIPTION_TIMEOUT_MS: 60_000,
  },
}))
vi.mock("../../lib/redis", () => ({
  redisConnection: { publish },
}))
vi.mock("../../lib/object-store", () => ({
  objectStore: { get },
}))
vi.mock("../../queues/support-conversations", () => ({
  supportConversationsQueue: { add: vi.fn() },
}))

const model = "openai/gpt-4o-mini-transcribe"
const audioBytes = new Uint8Array([79, 103, 103, 83, 9, 9])

describe("transcribe inbound audio", () => {
  const container = new PostgreSqlContainer("pgvector/pgvector:pg18")
  let database: ReturnType<typeof createDatabase>
  let stop: () => Promise<void>
  let phone = 5511700000000

  beforeAll(async () => {
    const postgres = await container.start()
    stop = () => postgres.stop().then(() => undefined)
    database = createDatabase(postgres.getConnectionUri(), 10_000)
    databaseRef.current = database
    await database.db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`)
    await migrate(database.db, {
      migrationsFolder: resolve(process.cwd(), "../../packages/db/migrations"),
    })
  }, 60_000)

  afterAll(async () => {
    await Promise.allSettled([database?.close(), stop?.()])
  })

  beforeEach(() => {
    publish.mockReset()
    get.mockReset()
    get.mockImplementation(async () => ({
      body: new Response(audioBytes).body,
      contentType: "audio/ogg",
      contentLength: audioBytes.byteLength,
      etag: undefined,
    }))
    vi.mocked(supportConversationsQueue.add).mockReset()
  })

  function nextPhone(): string {
    phone += 1
    return `+${phone}`
  }

  async function createInboundAudio(input: {
    provider?: ChannelProvider
    body?: string | null
    downloadStatus?: "pending" | "stored" | "failed"
    objectKey?: string | null
  }) {
    const provider = input.provider ?? "twilio"
    const organizationId = createId()
    const contactId = createId()
    const channelIdentityId = createId()
    const channelConnectionId = createId()
    const supportConversationId = createId()
    const messageId = createId()
    const contactAddress = nextPhone()
    const channelAddress = nextPhone()

    await database.db.insert(organizations).values({
      id: organizationId,
      name: organizationId,
      slug: organizationId.toLowerCase(),
      status: "active",
      createdAt: new Date(),
    })
    await database.db.insert(contacts).values({ id: contactId, organizationId })
    await database.db.insert(channelIdentities).values({
      id: channelIdentityId,
      organizationId,
      contactId,
      channelType: "whatsapp",
      address: contactAddress,
    })
    await database.db.insert(channelConnections).values({
      id: channelConnectionId,
      organizationId,
      channelType: "whatsapp",
      name: "Support",
      address: channelAddress,
      status: "active",
    })
    await database.db.insert(channelConnectionProviderBindings).values({
      organizationId,
      channelConnectionId,
      provider,
      externalAccountId: "AC11111111111111111111111111111111",
      externalSenderId: "XE11111111111111111111111111111111",
      routingAddress: channelAddress,
      credentialsCiphertext: "not-a-credential",
      credentialsNonce: "not-a-credential",
      credentialsAuthTag: "not-a-credential",
      credentialsKeyVersion: "v1",
    })
    await database.db.insert(supportConversations).values({
      id: supportConversationId,
      organizationId,
      channelIdentityId,
      channelConnectionId,
      status: "open",
    })
    await database.db.insert(messages).values({
      id: messageId,
      organizationId,
      supportConversationId,
      channelConnectionId,
      direction: "inbound",
      senderType: "contact",
      contentType: "audio",
      body: input.body ?? null,
      status: "received",
      externalMessageId: `AUDIO-${messageId}`,
      occurredAt: new Date(),
    })
    await database.db.insert(messageMedia).values({
      organizationId,
      messageId,
      kind: "audio",
      mimeType: "audio/ogg",
      downloadStatus: input.downloadStatus ?? "stored",
      objectKey:
        input.objectKey === undefined ? "inbound/audio.ogg" : input.objectKey,
      providerRef: {},
    })

    return {
      organizationId,
      channelConnectionId,
      supportConversationId,
      messageId,
      channelIdentityId,
    }
  }

  function job(
    payload: {
      organizationId: string
      channelConnectionId: string
      supportConversationId: string
      messageId: string
    },
    attemptsMade = 0
  ): Job {
    return {
      data: payload,
      attemptsMade,
      opts: { attempts: 3 },
    } as Job
  }

  function dependencies(
    transcribe: TranscribeInboundAudioDependencies["transcriber"]["transcribe"]
  ): TranscribeInboundAudioDependencies {
    return {
      objectStore: { get },
      transcriber: { transcribe },
      model,
    }
  }

  async function messageBody(messageId: string) {
    const [message] = await database.db
      .select({ body: messages.body })
      .from(messages)
      .where(eq(messages.id, messageId))
    return message?.body
  }

  async function mediaRow(messageId: string) {
    const [row] = await database.db
      .select()
      .from(messageMedia)
      .where(eq(messageMedia.messageId, messageId))
    return row
  }

  async function auditRows(organizationId: string, messageId: string) {
    return database.db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.organizationId, organizationId),
          eq(auditEvents.subjectId, messageId)
        )
      )
  }

  it("writes the transcript onto the Message and enqueues processing", async () => {
    const state = await createInboundAudio({})
    const transcribe = vi.fn(async () => ({
      text: "Preciso de ajuda com a minha conta",
      language: "pt",
      model,
    }))

    await transcribeInboundAudio(job(state), dependencies(transcribe))

    expect(get).toHaveBeenCalledWith("inbound/audio.ogg")
    expect(transcribe).toHaveBeenCalledWith({
      bytes: audioBytes,
      mimeType: "audio/ogg",
    })
    await expect(messageBody(state.messageId)).resolves.toBe(
      "Preciso de ajuda com a minha conta"
    )
    await expect(mediaRow(state.messageId)).resolves.toMatchObject({
      transcriptStatus: "completed",
      transcriptModel: model,
      transcriptLanguage: "pt",
      transcriptionError: null,
    })
    expect(await auditRows(state.organizationId, state.messageId)).toHaveLength(
      0
    )
    expect(publish).toHaveBeenCalledWith(
      `inbox-events:${state.organizationId}`,
      JSON.stringify({
        type: "support_conversation.updated",
        conversationId: state.supportConversationId,
      })
    )
    expect(supportConversationsQueue.add).toHaveBeenCalledWith(
      "process-inbound-message",
      {
        organizationId: state.organizationId,
        channelIdentityId: state.channelIdentityId,
        supportConversationId: state.supportConversationId,
        messageId: state.messageId,
      },
      { jobId: `process-inbound-message--${state.messageId}` }
    )
  })

  it("fails a blank transcript and asks for a handoff", async () => {
    const state = await createInboundAudio({})
    const transcribe = vi.fn(async () => ({ text: "   ", model }))

    await transcribeInboundAudio(job(state), dependencies(transcribe))

    await expect(mediaRow(state.messageId)).resolves.toMatchObject({
      transcriptStatus: "failed",
      transcriptionError: "empty_transcript",
    })
    await expect(messageBody(state.messageId)).resolves.toBeNull()
    const [event] = await auditRows(state.organizationId, state.messageId)
    expect(event).toMatchObject({
      eventType: "message.audio_transcription_failed",
      actorType: "system",
      subjectType: "message",
      data: { reason: "empty_transcript", provider: "twilio", model },
    })
    expect(supportConversationsQueue.add).toHaveBeenCalledWith(
      "process-inbound-message",
      expect.objectContaining({ messageId: state.messageId }),
      expect.objectContaining({
        jobId: `process-inbound-message--${state.messageId}`,
      })
    )
  })

  it("retries a retryable transcription failure and fails on the last attempt", async () => {
    const state = await createInboundAudio({})
    const transcribe = vi.fn(async () => {
      throw new TranscriptionError("provider_error", true)
    })

    await expect(
      transcribeInboundAudio(job(state, 0), dependencies(transcribe))
    ).rejects.toBeInstanceOf(TranscriptionError)
    await expect(mediaRow(state.messageId)).resolves.toMatchObject({
      transcriptStatus: "transcribing",
    })
    expect(await auditRows(state.organizationId, state.messageId)).toHaveLength(
      0
    )

    await transcribeInboundAudio(job(state, 2), dependencies(transcribe))

    await expect(mediaRow(state.messageId)).resolves.toMatchObject({
      transcriptStatus: "failed",
      transcriptionError: "provider_error",
    })
    const [event] = await auditRows(state.organizationId, state.messageId)
    expect(event?.data).toEqual({
      reason: "provider_error",
      provider: "twilio",
      model,
    })
  })

  it("does not retry a terminal transcription failure", async () => {
    const state = await createInboundAudio({})
    const transcribe = vi.fn(async () => {
      throw new TranscriptionError("unauthorized", false)
    })

    await transcribeInboundAudio(job(state, 0), dependencies(transcribe))

    await expect(mediaRow(state.messageId)).resolves.toMatchObject({
      transcriptStatus: "failed",
      transcriptionError: "unauthorized",
    })
    expect(supportConversationsQueue.add).toHaveBeenCalledTimes(1)
  })

  it("is idempotent when the Message already has a transcript", async () => {
    const state = await createInboundAudio({ body: "Já transcrito" })
    const transcribe = vi.fn()

    await transcribeInboundAudio(job(state), dependencies(transcribe))

    expect(transcribe).not.toHaveBeenCalled()
    expect(get).not.toHaveBeenCalled()
    expect(supportConversationsQueue.add).toHaveBeenCalledTimes(1)
    expect(supportConversationsQueue.add).toHaveBeenCalledWith(
      "process-inbound-message",
      expect.objectContaining({ messageId: state.messageId }),
      expect.objectContaining({
        jobId: `process-inbound-message--${state.messageId}`,
      })
    )
  })

  it("fails when the audio was not stored", async () => {
    const state = await createInboundAudio({ downloadStatus: "pending" })
    const transcribe = vi.fn()

    await transcribeInboundAudio(job(state), dependencies(transcribe))

    expect(transcribe).not.toHaveBeenCalled()
    await expect(mediaRow(state.messageId)).resolves.toMatchObject({
      transcriptStatus: "failed",
      transcriptionError: "media_not_stored",
    })
    const [event] = await auditRows(state.organizationId, state.messageId)
    expect(event?.eventType).toBe("message.audio_transcription_failed")
  })
})
