import { createFileRoute } from "@tanstack/react-router"

import { PasswordResetRequestView } from "@/modules/auth/ui/views/password-reset-request-view"

export const Route = createFileRoute("/_auth/forgot-password")({
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  return <PasswordResetRequestView />
}
