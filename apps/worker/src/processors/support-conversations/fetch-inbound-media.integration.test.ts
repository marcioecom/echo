import type { FetchInboundMediaDependencies } from "./fetch-inbound-media"
import type { ChannelProvider } from "@workspace/domain"
import type {
  ChannelAdapter,
  ChannelAdapterRegistry,
} from "@workspace/messaging"
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
import { createId, maxInboundAudioBytes } from "@workspace/domain"
import { ChannelCredentialsCipher } from "@workspace/messaging"
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

import { supportConversationsQueue } from "../../queues/support-conversations"
import { fetchInboundMedia } from "./fetch-inbound-media"

const { databaseRef, encryptionKey, publish, put } = vi.hoisted(() => ({
  databaseRef: { current: {} as object },
  encryptionKey: Buffer.alloc(32, 7).toString("base64"),
  publish: vi.fn(),
  put: vi.fn(),
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
    CHANNEL_CREDENTIALS_ENCRYPTION_KEY: encryptionKey,
    CHANNEL_CREDENTIALS_KEY_VERSION: "v1",
  },
}))
vi.mock("../../lib/redis", () => ({
  redisConnection: { publish },
}))
vi.mock("../../lib/object-store", () => ({
  objectStore: { put },
}))
vi.mock("../../queues/support-conversations", () => ({
  supportConversationsQueue: { add: vi.fn() },
}))

const cipher = new ChannelCredentialsCipher({
  encryptionKey,
  keyVersion: "v1",
})

const audioBytes = new Uint8Array([79, 103, 103, 83, 1, 2, 3])

const mediaJobOptions = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 15_000 },
}

describe("fetch inbound media", () => {
  const container = new PostgreSqlContainer("pgvector/pgvector:pg18")
  let database: ReturnType<typeof createDatabase>
  let stop: () => Promise<void>
  let phone = 5511800000000

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
    put.mockReset()
    put.mockResolvedValue(undefined)
    vi.mocked(supportConversationsQueue.add).mockReset()
  })

  function nextPhone(): string {
    phone += 1
    return `+${phone}`
  }

  async function createInboundAudio(input: {
    provider?: ChannelProvider
    providerRef?: Record<string, string>
    downloadStatus?: "pending" | "stored" | "failed"
    objectKey?: string
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
    const externalMessageId = `MEDIA-${messageId}`
    const encrypted = cipher.encrypt("auth-token", {
      organizationId,
      channelConnectionId,
      provider,
    })

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
      credentialsCiphertext: encrypted.ciphertext,
      credentialsNonce: encrypted.nonce,
      credentialsAuthTag: encrypted.authTag,
      credentialsKeyVersion: encrypted.keyVersion,
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
      body: null,
      status: "received",
      externalMessageId,
      occurredAt: new Date(),
    })
    await database.db.insert(messageMedia).values({
      organizationId,
      messageId,
      kind: "audio",
      mimeType: "audio/ogg",
      downloadStatus: input.downloadStatus ?? "pending",
      objectKey: input.objectKey,
      providerRef:
        input.providerRef ??
        (provider === "twilio"
          ? { url: "https://api.twilio.test/media/1" }
          : { externalMessageId }),
    })

    return {
      organizationId,
      channelConnectionId,
      supportConversationId,
      messageId,
      contactAddress,
      channelAddress,
      externalMessageId,
      provider,
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
    fetchMedia: NonNullable<ChannelAdapter["fetchMedia"]>,
    baileysMedia = vi.fn()
  ): FetchInboundMediaDependencies {
    const provider = "twilio"
    const adapter: ChannelAdapter = {
      provider,
      delivery: "webhook",
      send: vi.fn(),
      health: vi.fn(),
      fetchMedia,
    }
    const registry: ChannelAdapterRegistry = { adapterFor: () => adapter }
    return {
      adapters: registry,
      objectStore: { put },
      baileysMedia: { fetchMedia: baileysMedia },
    }
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

  it("stores Twilio audio and enqueues transcription", async () => {
    const state = await createInboundAudio({})
    const fetchMedia = vi.fn(async () => ({
      stream: new Response(audioBytes).body!,
      mime: "audio/ogg; codecs=opus",
    }))

    await fetchInboundMedia(job(state), dependencies(fetchMedia))

    expect(fetchMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: state.organizationId,
        channelConnectionId: state.channelConnectionId,
        externalAccountId: "AC11111111111111111111111111111111",
        authToken: "auth-token",
      }),
      {
        externalMessageId: state.externalMessageId,
        url: "https://api.twilio.test/media/1",
      }
    )
    expect(put).toHaveBeenCalledWith({
      key: `organizations/${state.organizationId}/channels/${state.channelConnectionId}/inbound/${state.externalMessageId}.ogg`,
      body: audioBytes,
      contentType: "audio/ogg",
    })
    await expect(mediaRow(state.messageId)).resolves.toMatchObject({
      downloadStatus: "stored",
      objectKey: `organizations/${state.organizationId}/channels/${state.channelConnectionId}/inbound/${state.externalMessageId}.ogg`,
      mimeType: "audio/ogg",
      sizeBytes: audioBytes.byteLength,
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
      "transcribe-inbound-audio",
      {
        organizationId: state.organizationId,
        channelConnectionId: state.channelConnectionId,
        supportConversationId: state.supportConversationId,
        messageId: state.messageId,
      },
      {
        ...mediaJobOptions,
        jobId: `transcribe-inbound-audio--${state.messageId}`,
      }
    )
  })

  it("stores Baileys audio reported by the gateway without uploading it again", async () => {
    const state = await createInboundAudio({ provider: "baileys" })
    const baileysMedia = vi.fn(async () => ({
      ok: true as const,
      media: {
        objectKey: `inbound/${state.externalMessageId}.ogg`,
        mimeType: "audio/ogg",
        sizeBytes: 321,
        durationMs: 4500,
      },
    }))

    await fetchInboundMedia(job(state), dependencies(vi.fn(), baileysMedia))

    expect(baileysMedia).toHaveBeenCalledWith({
      organizationId: state.organizationId,
      channelConnectionId: state.channelConnectionId,
      externalMessageId: state.externalMessageId,
      senderAddress: state.contactAddress,
    })
    expect(put).not.toHaveBeenCalled()
    await expect(mediaRow(state.messageId)).resolves.toMatchObject({
      downloadStatus: "stored",
      objectKey: `inbound/${state.externalMessageId}.ogg`,
      sizeBytes: 321,
      durationMs: 4500,
    })
    expect(supportConversationsQueue.add).toHaveBeenCalledTimes(1)
  })

  it("marks unsupported audio mime as failed and asks for a handoff", async () => {
    const state = await createInboundAudio({})
    const fetchMedia = vi.fn(async () => ({
      stream: new Response(new Uint8Array([1, 2, 3])).body!,
      mime: "image/png",
    }))

    await fetchInboundMedia(job(state), dependencies(fetchMedia))

    await expect(mediaRow(state.messageId)).resolves.toMatchObject({
      downloadStatus: "failed",
      transcriptionError: "unsupported_mime",
    })
    expect(put).not.toHaveBeenCalled()
    const [event] = await auditRows(state.organizationId, state.messageId)
    expect(event).toMatchObject({
      eventType: "message.media_download_failed",
      actorType: "system",
      subjectType: "message",
      data: { reason: "unsupported_mime", provider: "twilio" },
    })
    expect(publish).toHaveBeenCalledTimes(1)
    expect(supportConversationsQueue.add).toHaveBeenCalledWith(
      "process-inbound-message",
      {
        organizationId: state.organizationId,
        channelIdentityId: expect.any(String),
        supportConversationId: state.supportConversationId,
        messageId: state.messageId,
      },
      { jobId: `process-inbound-message--${state.messageId}` }
    )
  })

  it("marks oversized audio as failed without uploading it", async () => {
    const state = await createInboundAudio({})
    const fetchMedia = vi.fn(async () => ({
      stream: new Response(new Uint8Array(maxInboundAudioBytes + 1)).body!,
      mime: "audio/ogg",
    }))

    await fetchInboundMedia(job(state), dependencies(fetchMedia))

    await expect(mediaRow(state.messageId)).resolves.toMatchObject({
      downloadStatus: "failed",
      transcriptionError: "media_too_large",
    })
    expect(put).not.toHaveBeenCalled()
  })

  it("retries transient download failures and fails on the last attempt", async () => {
    const state = await createInboundAudio({})
    const fetchMedia = vi.fn(async () => {
      throw new Error("network down")
    })

    await expect(
      fetchInboundMedia(job(state, 0), dependencies(fetchMedia))
    ).rejects.toThrow("network down")
    await expect(mediaRow(state.messageId)).resolves.toMatchObject({
      downloadStatus: "pending",
    })
    expect(await auditRows(state.organizationId, state.messageId)).toHaveLength(
      0
    )

    await fetchInboundMedia(job(state, 2), dependencies(fetchMedia))

    await expect(mediaRow(state.messageId)).resolves.toMatchObject({
      downloadStatus: "failed",
      transcriptionError: "retry_exhausted",
    })
    const [event] = await auditRows(state.organizationId, state.messageId)
    expect(event?.data).toEqual({
      reason: "retry_exhausted",
      provider: "twilio",
    })
    expect(supportConversationsQueue.add).toHaveBeenCalledWith(
      "process-inbound-message",
      expect.objectContaining({ messageId: state.messageId }),
      expect.objectContaining({
        jobId: `process-inbound-message--${state.messageId}`,
      })
    )
  })

  it("only enqueues transcription when the audio is already stored", async () => {
    const objectKey = "inbound/already-stored.ogg"
    const state = await createInboundAudio({
      downloadStatus: "stored",
      objectKey,
    })
    const fetchMedia = vi.fn()

    await fetchInboundMedia(job(state), dependencies(fetchMedia))

    expect(fetchMedia).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
    expect(publish).not.toHaveBeenCalled()
    expect(supportConversationsQueue.add).toHaveBeenCalledTimes(1)
    expect(supportConversationsQueue.add).toHaveBeenCalledWith(
      "transcribe-inbound-audio",
      expect.objectContaining({ messageId: state.messageId }),
      {
        ...mediaJobOptions,
        jobId: `transcribe-inbound-audio--${state.messageId}`,
      }
    )
  })

  it("stops when the audio already failed to download", async () => {
    const state = await createInboundAudio({ downloadStatus: "failed" })
    const fetchMedia = vi.fn()

    await fetchInboundMedia(job(state), dependencies(fetchMedia))

    expect(fetchMedia).not.toHaveBeenCalled()
    expect(supportConversationsQueue.add).not.toHaveBeenCalled()
    expect(await auditRows(state.organizationId, state.messageId)).toHaveLength(
      0
    )
  })
})
