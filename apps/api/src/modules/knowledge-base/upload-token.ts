import { createHmac, timingSafeEqual } from "node:crypto"

import { z } from "zod"

import { env } from "@/config/env"

const payloadSchema = z.object({
  uploadId: z.string().length(26),
  organizationId: z.string().length(26),
  createdByUserId: z.string().length(26),
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  objectKey: z.string().min(1),
  expiresAt: z.number().int().positive(),
})
export type KnowledgeUploadTokenPayload = z.infer<typeof payloadSchema>

function signature(encodedPayload: string): Buffer {
  return createHmac("sha256", env.KNOWLEDGE_UPLOAD_TOKEN_SECRET)
    .update(encodedPayload)
    .digest()
}

export function createKnowledgeUploadToken(
  payload: KnowledgeUploadTokenPayload
): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url")
  return `${encodedPayload}.${signature(encodedPayload).toString("base64url")}`
}

export function verifyKnowledgeUploadToken(token: string): KnowledgeUploadTokenPayload | null {
  const [encodedPayload, encodedSignature, ...rest] = token.split(".")
  if (!encodedPayload || !encodedSignature || rest.length > 0) return null

  let receivedSignature: Buffer
  try {
    receivedSignature = Buffer.from(encodedSignature, "base64url")
  } catch {
    return null
  }
  const expectedSignature = signature(encodedPayload)
  if (
    receivedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(receivedSignature, expectedSignature)
  ) {
    return null
  }

  try {
    const payload = payloadSchema.parse(
      JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"))
    )
    return payload.expiresAt > Date.now() ? payload : null
  } catch {
    return null
  }
}
