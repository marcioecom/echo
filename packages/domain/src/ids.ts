import { monotonicFactory } from "ulid"
import { z } from "zod"

export const ulidSchema = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/)
const generateUlid = monotonicFactory()

export function createId(): string {
  return generateUlid()
}
