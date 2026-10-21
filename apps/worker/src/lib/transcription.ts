import { z } from "zod"

const defaultBaseUrl = "https://ai-gateway.vercel.sh/v4/ai"
const gatewayProtocolVersion = "0.0.1"
const transcriptionModelSpecificationVersion = "4"
const defaultTimeoutMs = 60_000

const transcriptionResponseSchema = z.object({
  text: z.string(),
  language: z.string().nullish(),
})

export type TranscriptionFailureReason =
  | "rate_limited"
  | "provider_error"
  | "timeout"
  | "network"
  | "invalid_request"
  | "unauthorized"
  | "forbidden"
  | "payload_too_large"
  | "unsupported_media"
  | "invalid_response"

export class TranscriptionError extends Error {
  constructor(
    readonly reason: TranscriptionFailureReason,
    readonly retryable: boolean,
    options?: ErrorOptions
  ) {
    super("Audio transcription request failed", options)
    this.name = "TranscriptionError"
  }
}

export interface TranscriptionInput {
  bytes: Uint8Array
  mimeType: string
}

export interface TranscriptionResult {
  text: string
  language?: string
  model: string
}

export interface AudioTranscriber {
  transcribe(input: TranscriptionInput): Promise<TranscriptionResult>
}

export interface AudioTranscriberConfig {
  apiKey: string
  model: string
  baseUrl?: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

export function createAudioTranscriber(
  config: AudioTranscriberConfig
): AudioTranscriber {
  const baseUrl = (config.baseUrl ?? defaultBaseUrl).replace(/\/+$/, "")
  const timeoutMs = config.timeoutMs ?? defaultTimeoutMs
  const fetchImpl = config.fetchImpl ?? fetch

  return {
    async transcribe(input) {
      let response: Response
      try {
        response = await fetchImpl(`${baseUrl}/transcription-model`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
            "ai-gateway-protocol-version": gatewayProtocolVersion,
            "ai-transcription-model-specification-version":
              transcriptionModelSpecificationVersion,
            "ai-model-id": config.model,
          },
          body: JSON.stringify({
            audio: Buffer.from(input.bytes).toString("base64"),
            mediaType: input.mimeType,
          }),
          signal: AbortSignal.timeout(timeoutMs),
        })
      } catch (error) {
        throw requestFailure(error)
      }

      if (!response.ok) throw responseFailure(response.status)

      let body: unknown
      try {
        body = await response.json()
      } catch (error) {
        throw new TranscriptionError("invalid_response", true, { cause: error })
      }

      const parsed = transcriptionResponseSchema.safeParse(body)
      if (!parsed.success) {
        throw new TranscriptionError("invalid_response", true, {
          cause: parsed.error,
        })
      }

      return {
        text: parsed.data.text,
        ...(parsed.data.language ? { language: parsed.data.language } : {}),
        model: config.model,
      }
    },
  }
}

function requestFailure(error: unknown): TranscriptionError {
  if (isTimeout(error)) {
    return new TranscriptionError("timeout", true, { cause: error })
  }
  return new TranscriptionError("network", true, { cause: error })
}

function isTimeout(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("name" in error)) {
    return false
  }
  return error.name === "TimeoutError" || error.name === "AbortError"
}

function responseFailure(status: number): TranscriptionError {
  if (status === 429) return new TranscriptionError("rate_limited", true)
  if (status >= 500) return new TranscriptionError("provider_error", true)
  if (status === 401) return new TranscriptionError("unauthorized", false)
  if (status === 403) return new TranscriptionError("forbidden", false)
  if (status === 413) return new TranscriptionError("payload_too_large", false)
  if (status === 415) return new TranscriptionError("unsupported_media", false)
  return new TranscriptionError("invalid_request", false)
}
