import { emailJobNames } from "@workspace/jobs"
import { handleSendInvitationEmail } from "./send-invitation-email"
import { handleSendPasswordResetEmail } from "./send-password-reset-email"

export const emailProcessors = {
  [emailJobNames.sendInvitationEmail]: handleSendInvitationEmail,
  [emailJobNames.sendPasswordResetEmail]: handleSendPasswordResetEmail,
}
