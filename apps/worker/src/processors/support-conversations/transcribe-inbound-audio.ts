import type { AudioTranscriber } from "../../lib/transcription"
import type { TranscribeInboundAudioJob } from "@workspace/jobs"
import type { R2ObjectStore } from "@workspace/object-storage"
import type { Job } from "bullmq"

import {
  auditEvents,
  channelConnectionProviderBindings,
  messageMedia,
  messages,
  supportConversations,
} from "@workspace/db/schema"
import {
  isSupportedInboundAudioMimeType,
  maxInboundAudioBytes,
  normalizeAudioMimeType,
} from "@workspace/domain"
import {
  publishInboxEvent,
  supportConversationJobNames,
  transcribeInboundAudioJobSchema,
} from "@workspace/jobs"
import { createLoggerWithContext } from "@workspace/logger"
import { UnrecoverableError } from "bullmq"
import { and, eq, isNull } from "drizzle-orm"

import { env } from "../../config/env"
import { database } from "../../lib/db"
import { objectStore } from "../../lib/object-store"
import { redisConnection } from "../../lib/redis"
import {
  createAudioTranscriber,
  TranscriptionError,
} from "../../lib/transcription"
import { supportConversationsQueue } from "../../queues/support-conversations"
import { MediaSizeLimitError, readStreamToBytes } from "./fetch-inbound-media"

const logger = createLoggerWithContext("worker:transcribe-inbound-audio")

const transcriber = createAudioTranscriber({
  apiKey: env.AI_GATEWAY_API_KEY,
  model: env.AI_TRANSCRIPTION_MODEL,
  timeoutMs: env.AI_TRANSCRIPTION_TIMEOUT_MS,
})

export interface TranscribeInboundAudioDependencies {
  objectStore: Pick<R2ObjectStore, "get">
  transcriber: AudioTranscriber
  model: string
}

export function handleTranscribeInboundAudio(job: Job): Promise<void> {
  return transcribeInboundAudio(job, {
    objectStore,
    transcriber,
    model: env.AI_TRANSCRIPTION_MODEL,
  })
}

export async function transcribeInboundAudio(
  job: Job,
  dependencies: TranscribeInboundAudioDependencies
): Promise<void> {
  const payload = transcribeInboundAudioJobSchema.parse(job.data)
  const state = await loadInboundAudio(payload)

  if (!state) {
    throw new UnrecoverableError(
      "Audio transcription job IDs do not identify one tenant Message"
    )
  }

  if (state.body !== null && state.body.trim().length > 0) {
    await enqueueProcessInboundMessage(payload, state.channelIdentityId)
    return
  }

  if (state.downloadStatus !== "stored" || !state.objectKey) {
    await failTranscription({
      payload,
      state,
      reason: "media_not_stored",
      model: dependencies.model,
    })
    return
  }

  const mimeType = normalizeAudioMimeType(state.mimeType)
  const startedAt = Date.now()

  try {
    if (!isSupportedInboundAudioMimeType(mimeType)) {
      throw new UnsupportedAudioMimeError(mimeType)
    }

    await database.db
      .update(messageMedia)
      .set({ transcriptStatus: "transcribing", transcriptionError: null })
      .where(
        and(
          eq(messageMedia.organizationId, payload.organizationId),
          eq(messageMedia.messageId, payload.messageId)
        )
      )

    const object = await dependencies.objectStore.get(state.objectKey)
    if (!object.body) throw new MediaObjectMissingError()

    const bytes = await readStreamToBytes(object.body, maxInboundAudioBytes)
    const result = await dependencies.transcriber.transcribe({
      bytes,
      mimeType,
    })
    if (!result.text.trim()) throw new EmptyTranscriptError()

    const completed = await completeTranscription(
      payload,
      result,
      dependencies.model
    )
    if (!completed) return

    await publishInboxEvent(redisConnection, payload.organizationId, {
      type: "support_conversation.updated",
      conversationId: payload.supportConversationId,
    })
    await enqueueProcessInboundMessage(payload, state.channelIdentityId)

    logger.info("Inbound audio transcribed", {
      organizationId: payload.organizationId,
      conversationId: payload.supportConversationId,
      messageId: payload.messageId,
      jobId: job.id,
      provider: state.provider,
      model: result.model,
      durationMs: Date.now() - startedAt,
      outcome: "completed",
    })
  } catch (error) {
    const retryable = isRetryableTranscriptionFailure(error)
    if (retryable && !isFinalAttempt(job)) {
      throw error instanceof Error
        ? error
        : new Error("Audio transcription failed")
    }
    await failTranscription({
      payload,
      state,
      reason: transcriptionFailureReason(error, retryable),
      model: dependencies.model,
    })
  }
}

interface InboundAudioState {
  provider: string
  channelIdentityId: string
  body: string | null
  mimeType: string
  downloadStatus: "pending" | "stored" | "failed"
  objectKey: string | null
}

async function loadInboundAudio(input: TranscribeInboundAudioJob) {
  const [state] = await database.db
    .select({
      provider: channelConnectionProviderBindings.provider,
      channelIdentityId: supportConversations.channelIdentityId,
      body: messages.body,
      mimeType: messageMedia.mimeType,
      downloadStatus: messageMedia.downloadStatus,
      objectKey: messageMedia.objectKey,
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
      messageMedia,
      and(
        eq(messageMedia.organizationId, messages.organizationId),
        eq(messageMedia.messageId, messages.id)
      )
    )
    .leftJoin(
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
    .where(
      and(
        eq(messages.organizationId, input.organizationId),
        eq(messages.id, input.messageId),
        eq(messages.supportConversationId, input.supportConversationId),
        eq(messages.channelConnectionId, input.channelConnectionId),
        eq(messages.direction, "inbound"),
        eq(messages.senderType, "contact"),
        eq(messages.contentType, "audio")
      )
    )
    .limit(1)

  if (!state) return undefined
  return {
    ...state,
    provider: state.provider ?? "unknown",
  } as InboundAudioState
}

class EmptyTranscriptError extends Error {
  constructor() {
    super("Audio transcription returned no text")
    this.name = "EmptyTranscriptError"
  }
}

class MediaObjectMissingError extends Error {
  constructor() {
    super("Inbound audio object is missing")
    this.name = "MediaObjectMissingError"
  }
}

class UnsupportedAudioMimeError extends Error {
  constructor(readonly mimeType: string) {
    super("Inbound audio mime type is not supported")
    this.name = "UnsupportedAudioMimeError"
  }
}

async function completeTranscription(
  payload: TranscribeInboundAudioJob,
  result: { text: string; language?: string; model: string },
  model: string
): Promise<boolean> {
  return database.db.transaction(async (transaction) => {
    const updated = await transaction
      .update(messages)
      .set({ body: result.text })
      .where(
        and(
          eq(messages.organizationId, payload.organizationId),
          eq(messages.id, payload.messageId),
          isNull(messages.body)
        )
      )
      .returning({ id: messages.id })
    if (updated.length === 0) return false

    await transaction
      .update(messageMedia)
      .set({
        transcriptStatus: "completed",
        transcriptModel: result.model ?? model,
        transcriptLanguage: result.language ?? null,
        transcriptionError: null,
      })
      .where(
        and(
          eq(messageMedia.organizationId, payload.organizationId),
          eq(messageMedia.messageId, payload.messageId)
        )
      )
    return true
  })
}

function isRetryableTranscriptionFailure(error: unknown): boolean {
  if (error instanceof TranscriptionError) return error.retryable
  if (error instanceof EmptyTranscriptError) return false
  if (error instanceof MediaObjectMissingError) return false
  if (error instanceof UnsupportedAudioMimeError) return false
  if (error instanceof MediaSizeLimitError) return false
  if (error instanceof UnrecoverableError) return false
  return true
}

function transcriptionFailureReason(
  error: unknown,
  retryable: boolean
): string {
  if (error instanceof TranscriptionError) return error.reason
  if (error instanceof EmptyTranscriptError) return "empty_transcript"
  if (error instanceof MediaObjectMissingError) return "media_missing"
  if (error instanceof UnsupportedAudioMimeError) return "unsupported_mime"
  if (error instanceof MediaSizeLimitError) return "media_too_large"
  return retryable ? "retry_exhausted" : "transcription_failed"
}

function isFinalAttempt(job: Job): boolean {
  return job.attemptsMade + 1 >= (job.opts.attempts ?? 1)
}

async function enqueueProcessInboundMessage(
  payload: TranscribeInboundAudioJob,
  channelIdentityId: string
): Promise<void> {
  await supportConversationsQueue.add(
    supportConversationJobNames.processInboundMessage,
    {
      organizationId: payload.organizationId,
      channelIdentityId,
      supportConversationId: payload.supportConversationId,
      messageId: payload.messageId,
    },
    {
      jobId: `${supportConversationJobNames.processInboundMessage}--${payload.messageId}`,
    }
  )
}

async function failTranscription(input: {
  payload: TranscribeInboundAudioJob
  state: InboundAudioState
  reason: string
  model: string
}): Promise<void> {
  const { payload, state, reason, model } = input
  await database.db.transaction(async (transaction) => {
    await transaction
      .update(messageMedia)
      .set({ transcriptStatus: "failed", transcriptionError: reason })
      .where(
        and(
          eq(messageMedia.organizationId, payload.organizationId),
          eq(messageMedia.messageId, payload.messageId)
        )
      )
    await transaction.insert(auditEvents).values({
      organizationId: payload.organizationId,
      eventType: "message.audio_transcription_failed",
      actorType: "system",
      subjectType: "message",
      subjectId: payload.messageId,
      data: { reason, provider: state.provider, model },
    })
  })

  await publishInboxEvent(redisConnection, payload.organizationId, {
    type: "support_conversation.updated",
    conversationId: payload.supportConversationId,
  })
  await enqueueProcessInboundMessage(payload, state.channelIdentityId)

  logger.warn("Inbound audio transcription failed", {
    organizationId: payload.organizationId,
    conversationId: payload.supportConversationId,
    messageId: payload.messageId,
    provider: state.provider,
    model,
    reason,
    outcome: "failed",
  })
}
