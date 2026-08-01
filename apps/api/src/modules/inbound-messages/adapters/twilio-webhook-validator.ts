import twilio from "twilio"

export function validateTwilioWebhook(
  authToken: string,
  signature: string,
  url: string,
  form: Record<string, string>
): boolean {
  return twilio.validateRequest(authToken, signature, url, form)
}
