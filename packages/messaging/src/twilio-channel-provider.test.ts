import { describe, expect, it, vi } from "vitest"

import {
  TwilioChannelProvider,
  TwilioMediaError,
} from "./twilio-channel-provider"

const accountSid = "AC11111111111111111111111111111111"
const authToken = "secret-token"
const mediaUrl = "https://api.twilio.com/2010-04-01/Accounts/AC1/Media/ME1"

describe("TwilioChannelProvider.fetchMedia", () => {
  it("authenticates with basic auth and returns the media stream", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { "content-type": "audio/ogg; codecs=opus" },
        })
    )
    const provider = new TwilioChannelProvider(
      accountSid,
      authToken,
      fetchImpl as unknown as typeof fetch
    )

    const media = await provider.fetchMedia(mediaUrl)

    expect(media.mime).toBe("audio/ogg")
    expect(media.stream).toBeInstanceOf(ReadableStream)
    await expect(
      new Response(media.stream).arrayBuffer()
    ).resolves.toHaveProperty("byteLength", 3)
    expect(fetchImpl).toHaveBeenCalledWith(mediaUrl, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      },
    })
  })

  it("falls back to a binary mime type when Twilio omits content-type", async () => {
    const provider = new TwilioChannelProvider(
      accountSid,
      authToken,
      (async () => new Response(new Uint8Array([1]))) as typeof fetch
    )

    await expect(provider.fetchMedia(mediaUrl)).resolves.toMatchObject({
      mime: "application/octet-stream",
    })
  })

  it("classifies rate limit and server failures as retryable", async () => {
    for (const status of [429, 503]) {
      const provider = new TwilioChannelProvider(
        accountSid,
        authToken,
        (async () => new Response(null, { status })) as typeof fetch
      )

      await expect(provider.fetchMedia(mediaUrl)).rejects.toMatchObject({
        name: "TwilioMediaError",
        retryable: true,
        status,
      })
    }
  })

  it("classifies expired and unauthorized media as terminal", async () => {
    for (const [status, reason] of [
      [404, "media_expired"],
      [410, "media_expired"],
      [401, "media_unauthorized"],
      [413, "media_too_large"],
      [415, "media_unsupported"],
    ] as const) {
      const provider = new TwilioChannelProvider(
        accountSid,
        authToken,
        (async () => new Response(null, { status })) as typeof fetch
      )

      await expect(provider.fetchMedia(mediaUrl)).rejects.toMatchObject({
        name: "TwilioMediaError",
        reason,
        retryable: false,
      })
    }
  })

  it("wraps network failures as retryable errors", async () => {
    const provider = new TwilioChannelProvider(
      accountSid,
      authToken,
      (async () => {
        throw new Error("network down")
      }) as typeof fetch
    )

    await expect(provider.fetchMedia(mediaUrl)).rejects.toBeInstanceOf(
      TwilioMediaError
    )
    await expect(provider.fetchMedia(mediaUrl)).rejects.toMatchObject({
      retryable: true,
    })
  })
})
