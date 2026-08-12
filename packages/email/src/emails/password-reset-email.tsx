import * as React from "react"

import { EmailLayout, EmailNotice, EmailParagraph } from "./email-layout"

export interface PasswordResetEmailProps {
  logoUrl: string
  resetUrl: string
}

export function PasswordResetEmail({
  resetUrl = "https://example.com/reset-password?token=example",
  logoUrl = "https://echo-assets.marcio.run/brand/echo-logo-horizontal.png",
}: PasswordResetEmailProps) {
  return (
    <EmailLayout
      actionLabel="Reset password"
      actionUrl={resetUrl}
      logoUrl={logoUrl}
      preview="Reset your Echo password"
      title="Reset your password"
    >
      <EmailParagraph>
        We received a request to reset your Echo password. This link expires in
        30 minutes and can only be used once.
      </EmailParagraph>
      <EmailNotice>
        If you did not request this, you can safely ignore this email.
      </EmailNotice>
    </EmailLayout>
  )
}

export default PasswordResetEmail
