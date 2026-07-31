import {
  emailJobNames,
  emailQueueName,
  sendInvitationEmailJobSchema,
} from "./email"
import {
  type ProcessInboundMessageJob,
  processInboundMessageJobSchema,
  supportConversationJobNames,
  supportConversationsQueueName,
} from "./support-conversations"

export * from "./email"
export * from "./support-conversations"

export const jobDefinitions = {
  [emailJobNames.sendInvitationEmail]: {
    queueName: emailQueueName,
    schema: sendInvitationEmailJobSchema,
  },
  [supportConversationJobNames.processInboundMessage]: {
    queueName: supportConversationsQueueName,
    schema: processInboundMessageJobSchema,
    jobId: (payload: ProcessInboundMessageJob) =>
      `${supportConversationJobNames.processInboundMessage}--${payload.messageId}`,
  },
} as const

export type JobName = keyof typeof jobDefinitions
