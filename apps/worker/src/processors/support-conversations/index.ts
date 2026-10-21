import { supportConversationJobNames } from "@workspace/jobs"

import { handleFetchInboundMedia } from "./fetch-inbound-media"
import { handleProcessInboundMessage } from "./process-inbound-message"
import { handleSendOutboundMessage } from "./send-outbound-message"
import { handleTranscribeInboundAudio } from "./transcribe-inbound-audio"

export const supportConversationProcessors = {
  [supportConversationJobNames.processInboundMessage]:
    handleProcessInboundMessage,
  [supportConversationJobNames.sendOutboundMessage]: handleSendOutboundMessage,
  [supportConversationJobNames.fetchInboundMedia]: handleFetchInboundMedia,
  [supportConversationJobNames.transcribeInboundAudio]:
    handleTranscribeInboundAudio,
}
