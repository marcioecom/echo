export type AnalyticsOwner = "web" | "api" | "worker"

export const analyticsEventOwners = {
  signup_viewed: "web",
  signup_started: "web",
  signup_failed: "web",
  signup_completed: "api",
  organization_created: "api",
  invitation_sent: "api",
  whatsapp_connection_started: "web",
  channel_connection_created: "api",
  knowledge_upload_started: "web",
  knowledge_document_indexed: "worker",
  conversation_opened: "web",
  inbox_filter_applied: "web",
  operator_reply_started: "web",
  operator_reply_sent: "api",
  message_received: "worker",
  ai_reply_sent: "worker",
  handoff_requested: "worker",
  conversation_resolved: "api",
} as const satisfies Record<string, AnalyticsOwner>

export type AnalyticsEventName = keyof typeof analyticsEventOwners

export type AnalyticsEventProperties = {
  signup_viewed: { source?: string }
  signup_started: { method: "email"; source?: string }
  signup_failed: { method: "email"; code: string }
  signup_completed: { method: "email" }
  organization_created: { organizationId: string; role: string }
  invitation_sent: { organizationId: string; role: string }
  whatsapp_connection_started: { organizationId: string }
  channel_connection_created: {
    organizationId: string
    channelType: string
  }
  knowledge_upload_started: { organizationId: string }
  knowledge_document_indexed: {
    organizationId: string
    contentType: string
    chunkCount: number
  }
  conversation_opened: { organizationId: string; channelType: string }
  inbox_filter_applied: { organizationId: string; filter: string }
  operator_reply_started: { organizationId: string }
  operator_reply_sent: { organizationId: string; role: string }
  message_received: {
    organizationId: string
    channelType: string
    contentType: string
    isNewConversation: boolean
  }
  ai_reply_sent: {
    organizationId: string
    channelType: string
    automated: boolean
  }
  handoff_requested: {
    organizationId: string
    channelType: string
    reason: string
  }
  conversation_resolved: {
    organizationId: string
    resolvedBy: "operator" | "ai" | "system"
  }
}

export const analyticsGroupType = "organization" as const

export function organizationDistinctId(organizationId: string): string {
  return `organization:${organizationId}`
}

// PostHog payloads must never contain customer content.
const forbiddenAnalyticsPropertyKeys = new Set([
  "address",
  "body",
  "caption",
  "content",
  "displayName",
  "email",
  "fileName",
  "message",
  "messageBody",
  "name",
  "phone",
  "phoneNumber",
  "summary",
  "text",
  "transcript",
  "waId",
])

export class ForbiddenAnalyticsPropertyError extends Error {
  constructor(readonly key: string) {
    super(
      `Analytics property "${key}" may contain customer data. Capture the fact, not the content.`
    )
    this.name = "ForbiddenAnalyticsPropertyError"
  }
}

export function assertSafeAnalyticsProperties(
  properties: Record<string, unknown>
): void {
  for (const key of Object.keys(properties)) {
    if (forbiddenAnalyticsPropertyKeys.has(key)) {
      throw new ForbiddenAnalyticsPropertyError(key)
    }
  }
}
