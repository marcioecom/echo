import { Resend } from "resend"

export type { Resend } from "resend"

export function createResendClient(apiKey: string): Resend {
  return new Resend(apiKey)
}
