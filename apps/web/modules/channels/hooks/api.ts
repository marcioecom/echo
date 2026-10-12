import type { ChannelsCopy } from "../i18n"
import type { ChannelConnection } from "../types"

import { getApiUrl } from "@/lib/env"

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

export function channelErrorMessage(
  error: unknown,
  copy: ChannelsCopy
): string {
  if (!(error instanceof ChannelsApiError)) return copy.errors.generic
  if (error.code === "twilio_verification_failed") {
    return verificationMessage(error.reason, copy)
  }
  if (error.code === "channel_routing_conflict")
    return copy.errors.routingConflict
  if (error.code === "baileys_session_exists") return copy.errors.sessionExists
  if (error.code === "pairing_required") return copy.errors.pairingRequired
  if (error.code === "invalid_request") return copy.errors.invalid
  return copy.errors.generic
}

export function humanChannelError(value: string, copy: ChannelsCopy): string {
  return verificationMessage(value, copy)
}

function verificationMessage(
  reason: string | undefined,
  copy: ChannelsCopy
): string {
  if (reason && isVerificationReason(reason)) return copy.verification[reason]
  return reason && reason.length > 0
    ? reason
    : copy.verification.provider_request_failed
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
