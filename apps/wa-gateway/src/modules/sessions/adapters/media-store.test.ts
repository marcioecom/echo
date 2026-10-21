import { inboundMediaObjectKey } from "@workspace/domain"
import { describe, expect, it, vi } from "vitest"

import { createInboundMediaStore } from "./media-store"

const organizationId = "01K1EDN69NFBWCG42B2H99V2C1"
const channelConnectionId = "01K1EDN9C8VT0N8WRM13RM6M55"
const externalMessageId = "wamid.audio.1"
const bytes = new Uint8Array([1, 2, 3, 4])

describe("createInboundMediaStore", () => {
  it("uploads under the canonical inbound key and returns metadata", async () => {
    const put = vi.fn(async () => undefined)
    const storeMedia = createInboundMediaStore({ store: { put } })

    await expect(
      storeMedia({
        organizationId,
        channelConnectionId,
        externalMessageId,
        bytes,
        mimeType: "Audio/OGG; codecs=opus",
      })
    ).resolves.toEqual({
      objectKey: inboundMediaObjectKey({
        organizationId,
        channelConnectionId,
        externalMessageId,
        mimeType: "audio/ogg",
      }),
      mimeType: "audio/ogg",
      sizeBytes: 4,
    })

    expect(put).toHaveBeenCalledWith({
      key: `organizations/${organizationId}/channels/${channelConnectionId}/inbound/${externalMessageId}.ogg`,
      body: bytes,
      contentType: "audio/ogg",
    })
  })

  it("propagates storage failures", async () => {
    const put = vi.fn(async () => {
      throw new Error("r2 unavailable")
    })
    const storeMedia = createInboundMediaStore({ store: { put } })

    await expect(
      storeMedia({
        organizationId,
        channelConnectionId,
        externalMessageId,
        bytes,
        mimeType: "audio/mpeg",
      })
    ).rejects.toThrow("r2 unavailable")
  })
})
