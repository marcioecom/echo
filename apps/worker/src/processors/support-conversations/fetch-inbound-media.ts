import type { BaileysMediaTransport } from "./baileys-media-transport"
import type { FetchInboundMediaJob } from "@workspace/jobs"
import type { ChannelAdapterRegistry } from "@workspace/messaging"
import type { R2ObjectStore } from "@workspace/object-storage"
import type { Job } from "bullmq"

import {
  auditEvents,
  channelConnectionProviderBindings,
  channelConnections,
  channelIdentities,
  messageMedia,
  messages,
  organizations,
  supportConversations,
} from "@workspace/db/schema"
import {
  inboundMediaObjectKey,
  isSupportedInboundAudioMimeType,
  maxInboundAudioBytes,
  normalizeAudioMimeType,
} from "@workspace/domain"
import {
  fetchInboundMediaJobSchema,
  inboundMediaJobOptions,
  publishInboxEvent,
  supportConversationJobNames,
} from "@workspace/jobs"
import { createLoggerWithContext } from "@workspace/logger"
import {
  ChannelCredentialsCipher,
  createChannelAdapterRegistry,
  TwilioMediaError,
  TwilioMediaRequestError,
} from "@workspace/messaging"
import { UnrecoverableError } from "bullmq"
import { and, eq } from "drizzle-orm"

import { env } from "../../config/env"
import { database } from "../../lib/db"
import { objectStore } from "../../lib/object-store"
import { redisConnection } from "../../lib/redis"
import { supportConversationsQueue } from "../../queues/support-conversations"
import { createBaileysMediaTransport } from "./baileys-media-transport"
import { createBaileysSendTransport } from "./baileys-send-transport"

const logger = createLoggerWithContext("worker:fetch-inbound-media")

const credentialsCipher = new ChannelCredentialsCipher({
  encryptionKey: env.CHANNEL_CREDENTIALS_ENCRYPTION_KEY,
  keyVersion: env.CHANNEL_CREDENTIALS_KEY_VERSION,
})

export interface FetchInboundMediaDependencies {
  adapters: ChannelAdapterRegistry
  objectStore: Pick<R2ObjectStore, "put">
  baileysMedia: BaileysMediaTransport
}

let defaultAdapters: ChannelAdapterRegistry | undefined
let defaultBaileysMedia: BaileysMediaTransport | undefined

function adapters(): ChannelAdapterRegistry {
  defaultAdapters ??= createChannelAdapterRegistry(
    env.PUBLIC_API_URL,
    createBaileysSendTransport(redisConnection)
  )
  return defaultAdapters
}

function baileysMedia(): BaileysMediaTransport {
  defaultBaileysMedia ??= createBaileysMediaTransport(redisConnection)
  return defaultBaileysMedia
}

export function handleFetchInboundMedia(job: Job): Promise<void> {
  return fetchInboundMedia(job, {
    adapters: adapters(),
    objectStore,
    baileysMedia: baileysMedia(),
  })
}

export async function fetchInboundMedia(
  job: Job,
  dependencies: FetchInboundMediaDependencies
): Promise<void> {
  const payload = fetchInboundMediaJobSchema.parse(job.data)
  const state = await loadInboundAudio(payload)

  if (!state) {
    throw new UnrecoverableError(
      "Inbound media job IDs do not identify one tenant audio Message"
    )
  }

  if (state.downloadStatus === "failed") return
  if (state.downloadStatus === "stored") {
    await enqueueTranscription(payload)
    return
  }

  let media: StoredMedia
  try {
    media =
      state.provider === "twilio"
        ? await fetchTwilioMedia(payload, state, dependencies)
        : await fetchBaileysMedia(payload, state, dependencies)
  } catch (error) {
    const retryable = isRetryableMediaFailure(error)
    if (retryable && !isFinalAttempt(job)) {
      throw error instanceof Error
        ? error
        : new Error("Inbound media download failed")
    }
    await failMedia({
      payload,
      state,
      reason: mediaFailureReason(error, retryable),
    })
    return
  }

  await database.db
    .update(messageMedia)
    .set({
      downloadStatus: "stored",
      objectKey: media.objectKey,
      mimeType: media.mimeType,
      sizeBytes: media.sizeBytes ?? state.sizeBytes ?? null,
      durationMs: media.durationMs ?? state.durationMs ?? null,
      transcriptionError: null,
    })
    .where(
      and(
        eq(messageMedia.organizationId, payload.organizationId),
        eq(messageMedia.messageId, payload.messageId)
      )
    )

  await publishInboxEvent(redisConnection, payload.organizationId, {
    type: "support_conversation.updated",
    conversationId: payload.supportConversationId,
  })
  await enqueueTranscription(payload)

  logger.info("Inbound audio stored", {
    organizationId: payload.organizationId,
    conversationId: payload.supportConversationId,
    messageId: payload.messageId,
    jobId: job.id,
    provider: state.provider,
    mimeType: media.mimeType,
    sizeBytes: media.sizeBytes,
    outcome: "stored",
  })
}

interface InboundAudioState {
  provider: string
  contactAddress: string
  channelIdentityId: string
  channelConnectionId: string
  channelAddress: string
  externalMessageId: string | null
  externalAccountId: string | null
  ciphertext: string | null
  nonce: string | null
  authTag: string | null
  keyVersion: string | null
  providerRef: Record<string, string>
  downloadStatus: "pending" | "stored" | "failed"
  mimeType: string
  sizeBytes: number | null
  durationMs: number | null
}

interface StoredMedia {
  objectKey: string
  mimeType: string
  sizeBytes?: number
  durationMs?: number
}

async function loadInboundAudio(input: FetchInboundMediaJob) {
  const [state] = await database.db
    .select({
      provider: channelConnectionProviderBindings.provider,
      contactAddress: channelIdentities.address,
      channelIdentityId: supportConversations.channelIdentityId,
      channelConnectionId: messages.channelConnectionId,
      channelAddress: channelConnections.address,
      externalMessageId: messages.externalMessageId,
      externalAccountId: channelConnectionProviderBindings.externalAccountId,
      ciphertext: channelConnectionProviderBindings.credentialsCiphertext,
      nonce: channelConnectionProviderBindings.credentialsNonce,
      authTag: channelConnectionProviderBindings.credentialsAuthTag,
      keyVersion: channelConnectionProviderBindings.credentialsKeyVersion,
      providerRef: messageMedia.providerRef,
      downloadStatus: messageMedia.downloadStatus,
      mimeType: messageMedia.mimeType,
      sizeBytes: messageMedia.sizeBytes,
      durationMs: messageMedia.durationMs,
    })
    .from(messages)
    .innerJoin(
      supportConversations,
      and(
        eq(supportConversations.organizationId, messages.organizationId),
        eq(supportConversations.id, messages.supportConversationId),
        eq(
          supportConversations.channelConnectionId,
          messages.channelConnectionId
        )
      )
    )
    .innerJoin(
      channelIdentities,
      and(
        eq(
          channelIdentities.organizationId,
          supportConversations.organizationId
        ),
        eq(channelIdentities.id, supportConversations.channelIdentityId)
      )
    )
    .innerJoin(
      channelConnections,
      and(
        eq(channelConnections.organizationId, messages.organizationId),
        eq(channelConnections.id, messages.channelConnectionId)
      )
    )
    .innerJoin(
      channelConnectionProviderBindings,
      and(
        eq(
          channelConnectionProviderBindings.organizationId,
          messages.organizationId
        ),
        eq(
          channelConnectionProviderBindings.channelConnectionId,
          messages.channelConnectionId
        )
      )
    )
    .innerJoin(
      messageMedia,
      and(
        eq(messageMedia.organizationId, messages.organizationId),
        eq(messageMedia.messageId, messages.id)
      )
    )
    .innerJoin(organizations, eq(organizations.id, messages.organizationId))
    .where(
      and(
        eq(messages.organizationId, input.organizationId),
        eq(messages.id, input.messageId),
        eq(messages.supportConversationId, input.supportConversationId),
        eq(messages.channelConnectionId, input.channelConnectionId),
        eq(messages.direction, "inbound"),
        eq(messages.senderType, "contact"),
        eq(messages.contentType, "audio"),
        eq(organizations.status, "active")
      )
    )
    .limit(1)

  if (!state) return undefined
  return { ...state, providerRef: state.providerRef ?? {} } as InboundAudioState
}

async function fetchTwilioMedia(
  payload: FetchInboundMediaJob,
  state: InboundAudioState,
  dependencies: FetchInboundMediaDependencies
): Promise<StoredMedia> {
  const adapter = dependencies.adapters.adapterFor("twilio")
  if (!adapter?.fetchMedia) {
    throw new TwilioMediaRequestError("provider_unavailable")
  }

  const url = state.providerRef.url
  if (!url) throw new TwilioMediaRequestError("missing_url")
  if (!state.externalAccountId) {
    throw new TwilioMediaRequestError("missing_account")
  }

  const authToken = decryptAuthToken(payload, state)
  const { stream, mime } = await adapter.fetchMedia(
    {
      organizationId: payload.organizationId,
      channelConnectionId: payload.channelConnectionId,
      fromAddress: state.channelAddress,
      externalAccountId: state.externalAccountId,
      authToken,
    },
    { externalMessageId: state.externalMessageId ?? payload.messageId, url }
  )

  const bytes = await readStreamToBytes(stream, maxInboundAudioBytes)
  const mimeType = validateAudioMime(mime || state.mimeType)
  if (bytes.byteLength === 0) {
    throw new TwilioMediaError("media_request_failed", false)
  }

  const objectKey = inboundMediaObjectKey({
    organizationId: payload.organizationId,
    channelConnectionId: payload.channelConnectionId,
    externalMessageId: state.externalMessageId ?? payload.messageId,
    mimeType,
  })
  await dependencies.objectStore.put({
    key: objectKey,
    body: bytes,
    contentType: mimeType,
  })

  return {
    objectKey,
    mimeType,
    sizeBytes: bytes.byteLength,
    ...(state.durationMs ? { durationMs: state.durationMs } : {}),
  }
}

async function fetchBaileysMedia(
  payload: FetchInboundMediaJob,
  state: InboundAudioState,
  dependencies: FetchInboundMediaDependencies
): Promise<StoredMedia> {
  const externalMessageId =
    state.providerRef.externalMessageId ?? state.externalMessageId
  if (!externalMessageId) {
    throw new UnrecoverableError("Inbound audio Message has no provider ref")
  }

  const result = await dependencies.baileysMedia.fetchMedia({
    organizationId: payload.organizationId,
    channelConnectionId: payload.channelConnectionId,
    externalMessageId,
    senderAddress: state.contactAddress,
  })
  if (!result.ok) {
    throw new BaileysMediaFailure(result.code, result.retryable)
  }

  const mimeType = validateAudioMime(result.media.mimeType || state.mimeType)
  if (
    result.media.sizeBytes !== undefined &&
    result.media.sizeBytes > maxInboundAudioBytes
  ) {
    throw new MediaSizeLimitError()
  }

  return {
    objectKey: result.media.objectKey,
    mimeType,
    ...(result.media.sizeBytes ? { sizeBytes: result.media.sizeBytes } : {}),
    ...(result.media.durationMs ? { durationMs: result.media.durationMs } : {}),
  }
}

class BaileysMediaFailure extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean
  ) {
    super("Baileys gateway could not provide inbound media")
    this.name = "BaileysMediaFailure"
  }
}

export class MediaSizeLimitError extends Error {
  constructor() {
    super("Inbound audio exceeds the maximum size")
    this.name = "MediaSizeLimitError"
  }
}

function decryptAuthToken(
  payload: FetchInboundMediaJob,
  state: InboundAudioState
): string {
  if (
    !state.ciphertext ||
    !state.nonce ||
    !state.authTag ||
    !state.keyVersion
  ) {
    throw new TwilioMediaRequestError("missing_credentials")
  }
  try {
    return credentialsCipher.decrypt(
      {
        ciphertext: state.ciphertext,
        nonce: state.nonce,
        authTag: state.authTag,
        keyVersion: state.keyVersion,
      },
      {
        organizationId: payload.organizationId,
        channelConnectionId: payload.channelConnectionId,
        provider: "twilio",
      }
    )
  } catch (error) {
    throw new TwilioMediaRequestError("missing_credentials", { cause: error })
  }
}

function validateAudioMime(mimeType: string): string {
  const normalized = normalizeAudioMimeType(mimeType)
  if (!isSupportedInboundAudioMimeType(normalized)) {
    throw new UnsupportedAudioMimeError(normalized)
  }
  return normalized
}

class UnsupportedAudioMimeError extends Error {
  constructor(readonly mimeType: string) {
    super("Inbound audio mime type is not supported")
    this.name = "UnsupportedAudioMimeError"
  }
}

export async function readStreamToBytes(
  stream: ReadableStream,
  maxBytes: number
): Promise<Uint8Array> {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      total += value.byteLength
      if (total > maxBytes) throw new MediaSizeLimitError()
      chunks.push(value)
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined)
    throw error
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

function isRetryableMediaFailure(error: unknown): boolean {
  if (error instanceof BaileysMediaFailure) return error.retryable
  if (error instanceof TwilioMediaError) return error.retryable
  if (error instanceof TwilioMediaRequestError) return error.retryable
  if (error instanceof MediaSizeLimitError) return false
  if (error instanceof UnsupportedAudioMimeError) return false
  if (error instanceof UnrecoverableError) return false
  return true
}

function mediaFailureReason(error: unknown, retryable: boolean): string {
  if (error instanceof BaileysMediaFailure) return error.code
  if (error instanceof TwilioMediaError) return error.reason
  if (error instanceof TwilioMediaRequestError) return error.reason
  if (error instanceof MediaSizeLimitError) return "media_too_large"
  if (error instanceof UnsupportedAudioMimeError) return "unsupported_mime"
  return retryable ? "retry_exhausted" : "download_failed"
}

function isFinalAttempt(job: Job): boolean {
  return job.attemptsMade + 1 >= (job.opts.attempts ?? 1)
}

async function enqueueTranscription(
  payload: FetchInboundMediaJob
): Promise<void> {
  await supportConversationsQueue.add(
    supportConversationJobNames.transcribeInboundAudio,
    payload,
    {
      ...inboundMediaJobOptions,
      jobId: `${supportConversationJobNames.transcribeInboundAudio}--${payload.messageId}`,
    }
  )
}

async function failMedia(input: {
  payload: FetchInboundMediaJob
  state: InboundAudioState
  reason: string
}): Promise<void> {
  const { payload, state, reason } = input
  await database.db.transaction(async (transaction) => {
    await transaction
      .update(messageMedia)
      .set({ downloadStatus: "failed", transcriptionError: reason })
      .where(
        and(
          eq(messageMedia.organizationId, payload.organizationId),
          eq(messageMedia.messageId, payload.messageId)
        )
      )
    await transaction.insert(auditEvents).values({
      organizationId: payload.organizationId,
      eventType: "message.media_download_failed",
      actorType: "system",
      subjectType: "message",
      subjectId: payload.messageId,
      data: { reason, provider: state.provider },
    })
  })

  await publishInboxEvent(redisConnection, payload.organizationId, {
    type: "support_conversation.updated",
    conversationId: payload.supportConversationId,
  })
  await supportConversationsQueue.add(
    supportConversationJobNames.processInboundMessage,
    {
      organizationId: payload.organizationId,
      channelIdentityId: state.channelIdentityId,
      supportConversationId: payload.supportConversationId,
      messageId: payload.messageId,
    },
    {
      jobId: `${supportConversationJobNames.processInboundMessage}--${payload.messageId}`,
    }
  )

  logger.warn("Inbound audio download failed", {
    organizationId: payload.organizationId,
    conversationId: payload.supportConversationId,
    messageId: payload.messageId,
    provider: state.provider,
    reason,
    outcome: "failed",
  })
}
