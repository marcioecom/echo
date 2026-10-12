import { inboundMessageContentSchema, ulidSchema } from "@workspace/domain"
import { z } from "zod"

export const waGatewayQueueName = "wa-gateway"
export const waIngressQueueName = "wa-ingress"

export const waGatewayJobNames = {
  connect: "wa-connect",
  pairingCode: "wa-pairing-code",
  send: "wa-send",
  logout: "wa-logout",
} as const

export const waIngressJobNames = {
  inbound: "wa-inbound",
  status: "wa-status",
} as const

const connectionJobSchema = z.object({
  organizationId: ulidSchema,
  channelConnectionId: ulidSchema,
})

export const waConnectJobSchema = connectionJobSchema
export type WaConnectJob = z.infer<typeof waConnectJobSchema>

export const waLogoutJobSchema = connectionJobSchema
export type WaLogoutJob = z.infer<typeof waLogoutJobSchema>

export const waPairingCodeJobSchema = connectionJobSchema.extend({
  phoneNumber: z.string().regex(/^\+[1-9]\d{1,14}$/),
})
export type WaPairingCodeJob = z.infer<typeof waPairingCodeJobSchema>

export const waSendJobSchema = connectionJobSchema.extend({
  outboundMessageId: ulidSchema,
  to: z.string().regex(/^\+[1-9]\d{1,14}$/),
  body: z.string().min(1),
})
export type WaSendJob = z.infer<typeof waSendJobSchema>

export const waInboundJobSchema = connectionJobSchema.extend({
  senderAddress: z.string().regex(/^\+[1-9]\d{1,14}$/),
  senderDisplayName: z.string().trim().min(1).optional(),
  externalMessageId: z.string().min(1),
  content: inboundMessageContentSchema,
  receivedAt: z.string().refine((value) => !Number.isNaN(Date.parse(value))),
})
export type WaInboundJob = z.infer<typeof waInboundJobSchema>

export const waStatusJobSchema = connectionJobSchema.extend({
  externalMessageId: z.string().min(1),
  status: z.enum(["pending", "sent", "delivered", "read", "failed"]),
})
export type WaStatusJob = z.infer<typeof waStatusJobSchema>
