import { env } from "@/config/env"

export function twilioInboundWebhookUrl(): string {
  return new URL(
    "/webhooks/twilio/whatsapp/inbound",
    env.PUBLIC_API_URL
  ).toString()
}
