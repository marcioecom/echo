import {
  emailJobNames,
  emailQueueName,
  sendInvitationEmailJobSchema,
  sendPasswordResetEmailJobSchema,
} from "./email"
import {
  type IndexKnowledgeDocumentJob,
  indexKnowledgeDocumentJobSchema,
  knowledgeBaseJobNames,
  knowledgeBaseQueueName,
} from "./knowledge-base"
import {
  type ProcessInboundMessageJob,
  processInboundMessageJobSchema,
  type SendOutboundMessageJob,
  sendOutboundMessageJobSchema,
  supportConversationJobNames,
  supportConversationsQueueName,
} from "./support-conversations"

export * from "./email"
export * from "./support-conversations"
export * from "./knowledge-base"

export const jobDefinitions = {
  [emailJobNames.sendInvitationEmail]: {
    queueName: emailQueueName,
    schema: sendInvitationEmailJobSchema,
  },
  [emailJobNames.sendPasswordResetEmail]: {
    queueName: emailQueueName,
    schema: sendPasswordResetEmailJobSchema,
  },
  [supportConversationJobNames.processInboundMessage]: {
    queueName: supportConversationsQueueName,
    schema: processInboundMessageJobSchema,
    jobId: (payload: ProcessInboundMessageJob) =>
      `${supportConversationJobNames.processInboundMessage}--${payload.messageId}`,
  },
  [supportConversationJobNames.sendOutboundMessage]: {
    queueName: supportConversationsQueueName,
    schema: sendOutboundMessageJobSchema,
    jobId: (payload: SendOutboundMessageJob) =>
      `${supportConversationJobNames.sendOutboundMessage}--${payload.messageId}`,
  },
  [knowledgeBaseJobNames.indexKnowledgeDocument]: {
    queueName: knowledgeBaseQueueName,
    schema: indexKnowledgeDocumentJobSchema,
    jobId: (payload: IndexKnowledgeDocumentJob) =>
      `${knowledgeBaseJobNames.indexKnowledgeDocument}--${payload.documentId}--${payload.revision}`,
  },
} as const

export type JobName = keyof typeof jobDefinitions
