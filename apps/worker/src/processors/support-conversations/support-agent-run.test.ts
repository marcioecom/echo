import { describe, expect, it } from "vitest"

import { buildSupportAgentRunConfig } from "./support-agent-run"

const input = {
  organizationId: "01ORGANIZATION000000000000",
  conversationId: "01CONVERSATION00000000000",
  messageId: "01MESSAGE00000000000000000",
  channelProvider: "baileys" as const,
  model: "openai/gpt-5.6-luna",
}

describe("buildSupportAgentRunConfig", () => {
  it("tags the run and keeps metadata limited to filter ids", () => {
    const config = buildSupportAgentRunConfig(input)

    expect(config).toEqual({
      runName: "support-agent",
      tags: ["support-agent", "inbound-message", "baileys"],
      metadata: {
        organizationId: input.organizationId,
        conversationId: input.conversationId,
        messageId: input.messageId,
        channelProvider: "baileys",
        model: input.model,
      },
    })
    expect(Object.keys(config.metadata ?? {}).sort()).toEqual([
      "channelProvider",
      "conversationId",
      "messageId",
      "model",
      "organizationId",
    ])
  })

  it("records an unknown provider when the connection has no binding", () => {
    const config = buildSupportAgentRunConfig({
      ...input,
      channelProvider: null,
    })

    expect(config.tags).toEqual(["support-agent", "inbound-message", "unknown"])
    expect(config.metadata).toMatchObject({ channelProvider: "unknown" })
  })
})
