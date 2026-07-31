import { supportConversationJobNames } from "@workspace/jobs"

import { handleProcessInboundMessage } from "./process-inbound-message"

export const supportConversationProcessors = {
  [supportConversationJobNames.processInboundMessage]:
    handleProcessInboundMessage,
}
