import type { ChannelConnection } from "@/modules/channels/types"
import type { InboxConversation } from "@/modules/inbox/types"
import type { KnowledgeDocument } from "@/modules/knowledge-base/types"

export type SetupStepId = "organization" | "channel" | "knowledge"

export type SetupStepStatus = "done" | "current" | "pending" | "todo"

export type SetupStep = {
  id: SetupStepId
  status: SetupStepStatus
  optional: boolean
}

export type SetupState = {
  hasOrganization: boolean
  hasActiveChannel: boolean
  hasPendingChannel: boolean
  pendingChannelId: string | null
  channelName: string | null
  channelAddress: string | null
  knowledgeReadyCount: number
  knowledgeIndexing: boolean
  steps: SetupStep[]
  completedSteps: number
  totalSteps: number
  currentStepId: SetupStepId | null
  needsSetup: boolean
}

/**
 * Derives the first-run checklist from live data instead of a stored flag, so
 * the steps can never claim progress the Organization does not actually have.
 */
export function resolveSetupState(input: {
  hasOrganization: boolean
  channels: ChannelConnection[]
  documents: KnowledgeDocument[]
}): SetupState {
  const activeChannel =
    input.channels.find((channel) => channel.status === "active") ?? null
  const pendingChannel =
    input.channels.find((channel) => channel.status === "pending") ?? null

  const readyDocuments = input.documents.filter(
    (document) => document.status === "ready"
  )
  const knowledgeIndexing = input.documents.some(
    (document) =>
      document.status === "pending" || document.status === "processing"
  )

  const organizationStatus: SetupStepStatus = input.hasOrganization
    ? "done"
    : "current"
  const channelStatus: SetupStepStatus = activeChannel
    ? "done"
    : pendingChannel
      ? "pending"
      : input.hasOrganization
        ? "current"
        : "todo"
  const knowledgeStatus: SetupStepStatus =
    readyDocuments.length > 0 ? "done" : knowledgeIndexing ? "pending" : "todo"

  const steps: SetupStep[] = [
    { id: "organization", status: organizationStatus, optional: false },
    { id: "channel", status: channelStatus, optional: false },
    { id: "knowledge", status: knowledgeStatus, optional: true },
  ]

  // Knowledge is recommended, not required. Counting it would keep the
  // checklist permanently incomplete for an Organization that skips it.
  const requiredSteps = steps.filter((step) => !step.optional)
  const completedSteps = requiredSteps.filter(
    (step) => step.status === "done"
  ).length
  const currentStep =
    requiredSteps.find((step) => step.status !== "done") ?? null

  return {
    hasOrganization: input.hasOrganization,
    hasActiveChannel: activeChannel !== null,
    hasPendingChannel: pendingChannel !== null,
    pendingChannelId: pendingChannel?.id ?? null,
    channelName: channelLabel(activeChannel ?? pendingChannel),
    channelAddress: activeChannel?.address ?? null,
    knowledgeReadyCount: readyDocuments.length,
    knowledgeIndexing,
    steps,
    completedSteps,
    totalSteps: requiredSteps.length,
    currentStepId: currentStep?.id ?? null,
    needsSetup: activeChannel === null,
  }
}

function channelLabel(channel: ChannelConnection | null): string | null {
  if (!channel) return null
  return channel.displayName ?? channel.name
}

/**
 * The first conversation is the proof the whole setup works, so the checklist
 * waits for it instead of stopping at "connected". An Echo reply is the real
 * answer: a contact message alone means the webhook delivered but nobody spoke.
 */
export function describeFirstConversation(
  conversation: InboxConversation | null
): { exists: boolean; echoAnswered: boolean } {
  const lastMessage = conversation?.lastMessage ?? null

  return {
    exists: conversation !== null,
    echoAnswered: lastMessage !== null && lastMessage.senderType !== "contact",
  }
}
