import { err, type Result } from "../../../common/result"
import { normalizeTwilioInboundMessage } from "../adapters/normalize-twilio-inbound-message"
import type { IngestedInboundMessage } from "../types"
import { authenticateTwilioWebhook } from "./authenticate-twilio-webhook"
import { ingestInboundMessage } from "./ingest-inbound-message"

export type ProcessTwilioInboundMessageError =
  | { type: "rejected"; reason: string }
  | { type: "queue_unavailable"; ingested: IngestedInboundMessage }

export async function processTwilioInboundMessage(input: {
  signature: string
  url: string
  form: Record<string, string>
  receivedAt: Date
}): Promise<
  Result<
    IngestedInboundMessage & { jobId: string },
    ProcessTwilioInboundMessageError
  >
> {
  const authenticated = await authenticateTwilioWebhook(input)
  if (!authenticated.ok) {
    return err({ type: "rejected", reason: authenticated.error })
  }

  const normalized = normalizeTwilioInboundMessage(
    authenticated.value,
    input.receivedAt
  )
  if (!normalized.ok) {
    return err({ type: "rejected", reason: "malformed_event" })
  }

  const ingested = await ingestInboundMessage(normalized.value)
  if (!ingested.ok) {
    return err({
      type: "queue_unavailable",
      ingested: ingested.error.ingested,
    })
  }

  return ingested
}
