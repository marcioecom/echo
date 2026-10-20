import type { ChannelConnection } from "../types"
import type { MessageKey } from "@/lib/i18n"

import { getApiUrl } from "@/lib/env"
import { t } from "@/lib/i18n"

const apiUrl = getApiUrl()

const verificationReasons = [
  "provider_request_failed",
  "sender_not_found",
  "sender_not_online",
  "invalid_sandbox_address",
  "account_not_active",
] as const

type VerificationReason = (typeof verificationReasons)[number]

export class ChannelsApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | undefined,
    readonly reason: string | undefined
  ) {
    super(message)
  }
}

const errorMessages = {
  channel_routing_conflict: "channels.errors.routingConflict",
  invalid_request: "channels.errors.invalid",
  pairing_required: "channels.errors.pairingRequired",
  queue_unavailable: "channels.errors.queueUnavailable",
} as const satisfies Record<string, MessageKey>

const verificationMessages = {
  account_not_active: "channels.verification.account_not_active",
  invalid_sandbox_address: "channels.verification.invalid_sandbox_address",
  provider_request_failed: "channels.verification.provider_request_failed",
  sender_not_found: "channels.verification.sender_not_found",
  sender_not_online: "channels.verification.sender_not_online",
} as const satisfies Record<VerificationReason, MessageKey>

const sessionErrorMessages = {
  qr_timeout: "channels.sessionErrors.qr_timeout",
  pairing_timeout: "channels.sessionErrors.pairing_timeout",
  pairing_failed: "channels.sessionErrors.pairing_failed",
  reconnect_exhausted: "channels.sessionErrors.reconnect_exhausted",
  routing_conflict: "channels.sessionErrors.routing_conflict",
  connection_replaced: "channels.sessionErrors.connection_replaced",
  missing_phone: "channels.sessionErrors.missing_phone",
  forbidden: "channels.sessionErrors.forbidden",
} as const satisfies Record<string, MessageKey>

export function channelErrorMessage(error: unknown): string {
  if (!(error instanceof ChannelsApiError)) return t("channels.errors.generic")
  if (error.code === "twilio_verification_failed") {
    return verificationMessage(error.reason)
  }
  if (error.code && error.code in errorMessages) {
    return t(errorMessages[error.code as keyof typeof errorMessages])
  }
  return t("channels.errors.generic")
}

export function humanChannelError(value: string): string {
  if (value in sessionErrorMessages) {
    return t(sessionErrorMessages[value as keyof typeof sessionErrorMessages])
  }
  return verificationMessage(value)
}

function verificationMessage(reason: string | undefined): string {
  if (reason && isVerificationReason(reason))
    return t(verificationMessages[reason])
  return reason && reason.length > 0
    ? reason
    : t("channels.verification.provider_request_failed")
}

function isVerificationReason(value: string): value is VerificationReason {
  return verificationReasons.some((reason) => reason === value)
}

async function request<T>(
  path: string,
  options?: { method?: "POST" | "PATCH" | "DELETE"; body?: unknown }
): Promise<T> {
  const response = await fetch(new URL(path, apiUrl), {
    method: options?.method,
    credentials: "include",
    headers: {
      accept: "application/json",
      ...(options?.body ? { "content-type": "application/json" } : {}),
    },
    ...(options?.body ? { body: JSON.stringify(options.body) } : {}),
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: unknown
      reason?: unknown
    } | null
    throw new ChannelsApiError(
      "The channels request could not be completed.",
      response.status,
      typeof body?.error === "string" ? body.error : undefined,
      typeof body?.reason === "string" ? body.reason : undefined
    )
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export function listChannels() {
  return request<{ items: ChannelConnection[] }>("/v1/channels")
}

export function createTwilioChannel(input: {
  displayName: string
  address: string
  accountSid: string
  authToken: string
  inboxId?: string
}) {
  return request<{ channel: ChannelConnection }>("/v1/channels", {
    method: "POST",
    body: { provider: "twilio", ...input },
  })
}

export function createBaileysChannel(input: {
  displayName: string
  inboxId?: string
}) {
  return request<{ channel: ChannelConnection }>("/v1/channels", {
    method: "POST",
    body: { provider: "baileys", ...input },
  })
}

export function requestPairingCode(
  channelConnectionId: string,
  phoneNumber: string
) {
  return request<{ accepted: boolean }>(
    `/v1/channels/${channelConnectionId}/pairing-code`,
    { method: "POST", body: { phoneNumber } }
  )
}

export function updateChannel(
  channelConnectionId: string,
  input: {
    displayName?: string
    inboxId?: string | null
    status?: "active" | "disabled"
  }
) {
  return request<{ channel: ChannelConnection }>(
    `/v1/channels/${channelConnectionId}`,
    { method: "PATCH", body: input }
  )
}

export function deleteChannel(channelConnectionId: string) {
  return request<void>(`/v1/channels/${channelConnectionId}`, {
    method: "DELETE",
  })
}

export function getChannelEventsUrl(): string {
  const url = new URL("/v1/support-conversations/events", apiUrl)
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
  return url.toString()
}
