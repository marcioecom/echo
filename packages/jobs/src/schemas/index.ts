import {
  emailJobNames,
  emailQueueName,
  sendInvitationEmailJobSchema,
} from "./email"

export * from "./email"

export const jobDefinitions = {
  [emailJobNames.sendInvitationEmail]: {
    queueName: emailQueueName,
    schema: sendInvitationEmailJobSchema,
  },
} as const

export type JobName = keyof typeof jobDefinitions
