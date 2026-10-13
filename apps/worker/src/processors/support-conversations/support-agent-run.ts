import type { RunnableConfig } from "@langchain/core/runnables"
import type { ChannelProvider } from "@workspace/domain"

export function buildSupportAgentRunConfig(input: {
  organizationId: string
  conversationId: string
  messageId: string
  channelProvider: ChannelProvider | null
  model: string
}): RunnableConfig {
  const channelProvider = input.channelProvider ?? "unknown"

  return {
    runName: "support-agent",
    tags: ["support-agent", "inbound-message", channelProvider],
    metadata: {
      organizationId: input.organizationId,
      conversationId: input.conversationId,
      messageId: input.messageId,
      channelProvider,
      model: input.model,
    },
  }
}
