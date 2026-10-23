import type { ChannelConnection } from "@/modules/channels/types"
import type { InboxConversation } from "@/modules/inbox/types"
import type { KnowledgeDocument } from "@/modules/knowledge-base/types"

import { describe, expect, it } from "vitest"

import { describeFirstConversation, resolveSetupState } from "./state"

function channel(
  status: ChannelConnection["status"],
  name = "Suporte"
): ChannelConnection {
  return {
    id: "channel",
    address: "+5511999999999",
    status,
    name,
    displayName: null,
  } as ChannelConnection
}

function document(status: KnowledgeDocument["status"]): KnowledgeDocument {
  return { id: "doc", status } as KnowledgeDocument
}

describe("resolveSetupState", () => {
  it("starts at the channel step once the Organization exists", () => {
    const state = resolveSetupState({
      hasOrganization: true,
      channels: [],
      documents: [],
    })

    expect(state.needsSetup).toBe(true)
    expect(state.currentStepId).toBe("channel")
    expect(state.completedSteps).toBe(1)
    expect(state.totalSteps).toBe(2)
    expect(state.steps.map((step) => step.status)).toEqual([
      "done",
      "current",
      "todo",
    ])
  })

  it("starts at the Organization step before it exists", () => {
    const state = resolveSetupState({
      hasOrganization: false,
      channels: [],
      documents: [],
    })

    expect(state.currentStepId).toBe("organization")
    expect(state.completedSteps).toBe(0)
  })

  it("keeps the channel step open while the pairing is pending", () => {
    const state = resolveSetupState({
      hasOrganization: true,
      channels: [channel("pending")],
      documents: [],
    })

    expect(state.hasPendingChannel).toBe(true)
    expect(state.hasActiveChannel).toBe(false)
    expect(state.pendingChannelId).toBe("channel")
    expect(state.needsSetup).toBe(true)
    expect(state.currentStepId).toBe("channel")
  })

  it("closes setup once a channel is active even without knowledge", () => {
    const state = resolveSetupState({
      hasOrganization: true,
      channels: [channel("active")],
      documents: [],
    })

    expect(state.needsSetup).toBe(false)
    expect(state.completedSteps).toBe(2)
    expect(state.currentStepId).toBeNull()
    expect(state.steps[2]?.optional).toBe(true)
  })

  it("reports ready and indexing knowledge separately", () => {
    const ready = resolveSetupState({
      hasOrganization: true,
      channels: [channel("active")],
      documents: [document("ready"), document("failed")],
    })
    expect(ready.knowledgeReadyCount).toBe(1)
    expect(ready.knowledgeIndexing).toBe(false)
    expect(ready.steps[2]?.status).toBe("done")

    const indexing = resolveSetupState({
      hasOrganization: true,
      channels: [channel("active")],
      documents: [document("processing")],
    })
    expect(indexing.knowledgeIndexing).toBe(true)
    expect(indexing.steps[2]?.status).toBe("pending")
  })
})

describe("describeFirstConversation", () => {
  function conversation(
    lastMessage: InboxConversation["lastMessage"]
  ): InboxConversation {
    return {
      id: "conversation",
      status: "ai_active",
      contact: {
        displayName: "Ana",
        address: "+5511999999999",
        channelType: "whatsapp",
      },
      lastActivityAt: "2026-10-22T12:00:00.000Z",
      lastMessage,
    }
  }

  it("treats a quiet Support Inbox as empty", () => {
    expect(describeFirstConversation(null)).toEqual({
      exists: false,
      echoAnswered: false,
    })
  })

  it("waits for a reply when only the contact has written", () => {
    expect(
      describeFirstConversation(
        conversation({
          preview: "Oi",
          senderType: "contact",
          contentType: "text",
          transcriptStatus: null,
        })
      )
    ).toEqual({ exists: true, echoAnswered: false })
  })

  it("counts an AI reply as the setup working", () => {
    expect(
      describeFirstConversation(
        conversation({
          preview: "Olá! Como posso ajudar?",
          senderType: "ai",
          contentType: "text",
          transcriptStatus: null,
        })
      )
    ).toEqual({ exists: true, echoAnswered: true })
  })

  it("counts a person taking over as an answer too", () => {
    expect(
      describeFirstConversation(
        conversation({
          preview: "Já te ajudo.",
          senderType: "operator",
          contentType: "text",
          transcriptStatus: null,
        })
      ).echoAnswered
    ).toBe(true)
  })
})
