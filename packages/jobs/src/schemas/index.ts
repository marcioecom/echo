import {
  emailJobNames,
  emailQueueName,
  sendInvitationEmailJobSchema,
  sendPasswordResetEmailJobSchema,
} from "./email"
import {
  type DeleteKnowledgeObjectJob,
  deleteKnowledgeObjectJobOptions,
  deleteKnowledgeObjectJobSchema,
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
import {
  waConnectJobSchema,
  waConnectionQueueName,
  waGatewayJobNames,
  waGatewayQueueName,
  waInboundJobSchema,
  waIngressJobNames,
  waIngressQueueName,
  waLogoutJobSchema,
  waStatusJobSchema,
  waPairingCodeJobSchema,
  type WaPairingCodeJob,
} from "./wa-gateway"

export * from "./email"
export * from "./support-conversations"
export * from "./knowledge-base"
export * from "./wa-gateway"

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
  [knowledgeBaseJobNames.deleteKnowledgeObject]: {
    queueName: knowledgeBaseQueueName,
    schema: deleteKnowledgeObjectJobSchema,
    options: deleteKnowledgeObjectJobOptions,
    jobId: (payload: DeleteKnowledgeObjectJob) =>
      `${knowledgeBaseJobNames.deleteKnowledgeObject}--${payload.deletionId}`,
  },
  [waGatewayJobNames.connect]: {
    queueName: waGatewayQueueName,
    schema: waConnectJobSchema,
  },
  [waGatewayJobNames.pairingCode]: {
    queueName: (payload: WaPairingCodeJob) =>
      waConnectionQueueName(payload.channelConnectionId),
    optionsQueue: waGatewayQueueName,
    schema: waPairingCodeJobSchema,
  },
  [waGatewayJobNames.logout]: {
    queueName: waGatewayQueueName,
    schema: waLogoutJobSchema,
  },
  [waIngressJobNames.inbound]: {
    queueName: waIngressQueueName,
    schema: waInboundJobSchema,
  },
  [waIngressJobNames.status]: {
    queueName: waIngressQueueName,
    schema: waStatusJobSchema,
  },
} as const

export type JobName = keyof typeof jobDefinitions
