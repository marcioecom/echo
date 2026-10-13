import { createFileRoute } from "@tanstack/react-router"

import { passwordResetHead } from "@/modules/auth/head"
import { resetPasswordSearchSchema } from "@/modules/auth/search"
import { PasswordResetView } from "@/modules/auth/ui/views/password-reset-view"

export const Route = createFileRoute("/_auth/reset-password")({
  validateSearch: resetPasswordSearchSchema,
  head: () => passwordResetHead(),
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  return <PasswordResetView />
}
