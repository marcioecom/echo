import { createFileRoute } from "@tanstack/react-router"

import { passwordResetRequestHead } from "@/modules/auth/head"
import { PasswordResetRequestView } from "@/modules/auth/ui/views/password-reset-request-view"

export const Route = createFileRoute("/_auth/forgot-password")({
  component: ForgotPasswordPage,
  head: () => passwordResetRequestHead(),
})

function ForgotPasswordPage() {
  return <PasswordResetRequestView />
}
