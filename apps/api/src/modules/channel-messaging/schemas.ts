import { z } from "zod"

const e164AddressSchema = z.string().regex(/^\+[1-9]\d{1,14}$/)

export const twilioAccountSidSchema = z.string().regex(/^AC[a-fA-F0-9]{32}$/)

export const whatsAppAddressSchema = z
  .string()
  .trim()
  .transform((value) =>
    value.startsWith("whatsapp:") ? value.slice("whatsapp:".length) : value
  )
  .pipe(e164AddressSchema)

export const provisionTwilioWhatsAppSchema = z.object({
  organizationId: z.ulid(),
  name: z.string().trim().min(1),
  address: whatsAppAddressSchema,
  accountSid: twilioAccountSidSchema,
  authToken: z.string().min(1),
  sandbox: z.boolean().default(false),
})

export type ProvisionTwilioWhatsAppInput = z.input<
  typeof provisionTwilioWhatsAppSchema
>
