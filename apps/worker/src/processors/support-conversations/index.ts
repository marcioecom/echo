import { supportConversationJobNames } from "@workspace/jobs"

import { handleProcessInboundMessage } from "./process-inbound-message"
import { handleSendOutboundMessage } from "./send-outbound-message"

export const supportConversationProcessors = {
  [supportConversationJobNames.processInboundMessage]:
    handleProcessInboundMessage,
  [supportConversationJobNames.sendOutboundMessage]: handleSendOutboundMessage,
}
