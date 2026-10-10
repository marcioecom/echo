import { createFileRoute } from "@tanstack/react-router"

import { resetPasswordSearchSchema } from "@/modules/auth/search"
import { PasswordResetView } from "@/modules/auth/ui/views/password-reset-view"

export const Route = createFileRoute("/_auth/reset-password")({
  validateSearch: resetPasswordSearchSchema,
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  return <PasswordResetView />
}
