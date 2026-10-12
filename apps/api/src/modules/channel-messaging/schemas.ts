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

const optionalInboxIdSchema = z.string().trim().min(1).max(64).optional()

export const createTwilioChannelSchema = z.object({
  provider: z.literal("twilio"),
  displayName: z.string().trim().min(1).max(120),
  address: z
    .string()
    .trim()
    .transform((value) => value.replace(/[\s()-]/g, ""))
    .pipe(whatsAppAddressSchema),
  accountSid: twilioAccountSidSchema,
  authToken: z.string().trim().min(1).max(128),
  inboxId: optionalInboxIdSchema,
  sandbox: z.boolean().optional().default(false),
})

export const updateChannelConnectionSchema = z
  .object({
    displayName: z.string().trim().min(1).max(120).optional(),
    inboxId: z.union([z.string().trim().min(1).max(64), z.null()]).optional(),
    status: z.enum(["active", "disabled"]).optional(),
  })
  .refine(
    (value) =>
      value.displayName !== undefined ||
      value.inboxId !== undefined ||
      value.status !== undefined,
    "empty_update"
  )

export const channelConnectionParamsSchema = z.object({
  channelConnectionId: z.ulid(),
})

export type ProvisionTwilioWhatsAppInput = z.input<
  typeof provisionTwilioWhatsAppSchema
>
