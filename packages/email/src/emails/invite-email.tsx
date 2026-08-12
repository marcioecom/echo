import * as React from "react"

import { EmailLayout, EmailParagraph } from "./email-layout"

export interface InviteEmailProps {
  inviterName: string
  organizationName: string
  inviteUrl: string
  logoUrl: string
}

export function InviteEmail({
  inviterName = "Jane Doe",
  organizationName = "Acme",
  inviteUrl = "https://example.com/accept-invitation/01",
  logoUrl = "https://echo-assets.marcio.run/brand/echo-logo-horizontal.png",
}: InviteEmailProps) {
  return (
    <EmailLayout
      actionLabel="Accept invitation"
      actionUrl={inviteUrl}
      logoUrl={logoUrl}
      preview={`${inviterName} invited you to ${organizationName} on Echo`}
      title={`Join ${organizationName} on Echo`}
    >
      <EmailParagraph>
        {inviterName} invited you to join <strong>{organizationName}</strong>.
        Accept the invitation to start working with the team.
      </EmailParagraph>
    </EmailLayout>
  )
}

export default InviteEmail
