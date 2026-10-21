import type { Result } from "@/common/result"

import { err, ok } from "@/common/result"
import { objectStore } from "@/lib/object-store"

import { supportInboxRepository } from "../repositories/support-inbox-repository"

const mediaUrlExpiresInSeconds = 300

export type GetMessageMediaUrlError = { type: "not_found" }

export interface MessageMediaUrl {
  url: string
  expiresAt: string
  mimeType: string
  durationMs: number | null
}

export async function getMessageMediaUrl(input: {
  organizationId: string
  conversationId: string
  messageId: string
}): Promise<Result<MessageMediaUrl, GetMessageMediaUrlError>> {
  const media = await supportInboxRepository.findMessageMedia(input)
  if (!media) return err({ type: "not_found" })

  const signed = await objectStore.presignGet({
    key: media.objectKey,
    expiresIn: mediaUrlExpiresInSeconds,
  })

  return ok({
    url: signed.url,
    expiresAt: signed.expiresAt.toISOString(),
    mimeType: media.mimeType,
    durationMs: media.durationMs,
  })
}
