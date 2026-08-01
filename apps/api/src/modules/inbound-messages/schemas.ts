import { z } from "zod"

const e164AddressSchema = z.string().regex(/^\+[1-9]\d{1,14}$/)

export const twilioAccountSidSchema = z.string().regex(/^AC[a-fA-F0-9]{32}$/)

export function normalizeWhatsAppAddress(value: string): string {
  const trimmed = value.trim()
  const address = trimmed.startsWith("whatsapp:")
    ? trimmed.slice("whatsapp:".length)
    : trimmed

  return e164AddressSchema.parse(address)
}

export const provisionTwilioWhatsAppSchema = z.object({
  organizationId: z.ulid(),
  name: z.string().trim().min(1),
  address: z.string().transform(normalizeWhatsAppAddress),
  accountSid: twilioAccountSidSchema,
  authToken: z.string().min(1),
  sandbox: z.boolean().default(false),
})

export type ProvisionTwilioWhatsAppInput = z.input<
  typeof provisionTwilioWhatsAppSchema
>

export const twilioWebhookFormSchema = z.record(z.string(), z.string())

export const twilioWebhookRoutingSchema = z.object({
  AccountSid: twilioAccountSidSchema,
  To: z.string().transform(normalizeWhatsAppAddress),
})
