import { describe, expect, it, vi } from "vitest"

import { createAudioTranscriber, TranscriptionError } from "./transcription"

const apiKey = "gateway-secret-key"
const bytes = new Uint8Array([9, 8, 7, 6])

function transcriberWith(fetchImpl: typeof fetch) {
  return createAudioTranscriber({
    apiKey,
    model: "openai/gpt-4o-mini-transcribe",
    timeoutMs: 5_000,
    fetchImpl,
  })
}

describe("createAudioTranscriber", () => {
  it("posts audio to the AI Gateway transcription endpoint and parses the transcript", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ text: "Olá, preciso de ajuda", language: "pt" }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
    )

    const result = await transcriberWith(
      fetchImpl as unknown as typeof fetch
    ).transcribe({
      bytes,
      mimeType: "audio/ogg",
    })

    expect(result).toEqual({
      text: "Olá, preciso de ajuda",
      language: "pt",
      model: "openai/gpt-4o-mini-transcribe",
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(url).toBe("https://ai-gateway.vercel.sh/v4/ai/transcription-model")
    expect(init.method).toBe("POST")
    expect(init.headers).toEqual({
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "ai-gateway-protocol-version": "0.0.1",
      "ai-transcription-model-specification-version": "4",
      "ai-model-id": "openai/gpt-4o-mini-transcribe",
    })
    expect(init.signal).toBeInstanceOf(AbortSignal)
    expect(JSON.parse(init.body as string)).toEqual({
      audio: Buffer.from(bytes).toString("base64"),
      mediaType: "audio/ogg",
    })
  })

  it("omits an absent language and returns an empty transcript to the caller", async () => {
    const transcriber = transcriberWith(
      (async () =>
        new Response(JSON.stringify({ text: "  " }), {
          status: 200,
        })) as typeof fetch
    )

    await expect(
      transcriber.transcribe({
        bytes,
        mimeType: "audio/ogg",
      })
    ).resolves.toEqual({
      text: "  ",
      model: "openai/gpt-4o-mini-transcribe",
    })
  })

  it("retries rate limits, server failures, timeouts and network errors", async () => {
    const responses: Array<() => Promise<Response>> = [
      async () => new Response(null, { status: 429 }),
      async () => new Response(null, { status: 502 }),
      async () => {
        throw Object.assign(new Error("timed out"), { name: "TimeoutError" })
      },
      async () => {
        throw new TypeError("fetch failed")
      },
    ]

    for (const response of responses) {
      await expect(
        transcriberWith(response as typeof fetch).transcribe({
          bytes,
          mimeType: "audio/ogg",
        })
      ).rejects.toMatchObject({ name: "TranscriptionError", retryable: true })
    }
  })

  it("does not retry invalid requests, credentials or unsupported media", async () => {
    for (const [status, reason] of [
      [400, "invalid_request"],
      [401, "unauthorized"],
      [403, "forbidden"],
      [413, "payload_too_large"],
      [415, "unsupported_media"],
    ] as const) {
      const error = await transcriberWith(
        (async () => new Response(null, { status })) as typeof fetch
      )
        .transcribe({ bytes, mimeType: "audio/ogg" })
        .catch((caught: unknown) => caught)

      expect(error).toBeInstanceOf(TranscriptionError)
      expect(error).toMatchObject({ reason, retryable: false })
    }
  })

  it("never exposes the api key or audio bytes in the error message", async () => {
    const error = await transcriberWith(
      (async () => new Response("nope", { status: 401 })) as typeof fetch
    )
      .transcribe({ bytes, mimeType: "audio/ogg" })
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(TranscriptionError)
    const message = (error as Error).message
    expect(message).not.toContain(apiKey)
    expect(message).not.toContain(Buffer.from(bytes).toString("base64"))
  })

  it("rejects malformed gateway responses as retryable", async () => {
    await expect(
      transcriberWith(
        (async () =>
          new Response(JSON.stringify({ nope: true }))) as typeof fetch
      ).transcribe({ bytes, mimeType: "audio/ogg" })
    ).rejects.toMatchObject({ reason: "invalid_response", retryable: true })
  })
})
