import type { WaMediaResult } from "@workspace/jobs"
import type { R2ObjectStore } from "@workspace/object-storage"

import {
  inboundMediaObjectKey,
  normalizeAudioMimeType,
} from "@workspace/domain"

export interface StoreInboundMediaInput {
  organizationId: string
  channelConnectionId: string
  externalMessageId: string
  bytes: Uint8Array
  mimeType: string
}

export type StoreInboundMedia = (
  input: StoreInboundMediaInput
) => Promise<WaMediaResult>

export function createInboundMediaStore(input: {
  store: Pick<R2ObjectStore, "put">
}): StoreInboundMedia {
  return async (media) => {
    const mimeType = normalizeAudioMimeType(media.mimeType)
    const objectKey = inboundMediaObjectKey({
      organizationId: media.organizationId,
      channelConnectionId: media.channelConnectionId,
      externalMessageId: media.externalMessageId,
      mimeType,
    })
    await input.store.put({
      key: objectKey,
      body: media.bytes,
      contentType: mimeType,
    })
    return {
      objectKey,
      mimeType,
      sizeBytes: media.bytes.byteLength,
    }
  }
}
