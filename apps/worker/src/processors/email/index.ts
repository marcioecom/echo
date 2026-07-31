import { emailJobNames } from "@workspace/jobs"
import { handleSendInvitationEmail } from "./send-invitation-email"

export const emailProcessors = {
  [emailJobNames.sendInvitationEmail]: handleSendInvitationEmail,
}
