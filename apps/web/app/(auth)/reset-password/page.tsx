import { Suspense } from "react"

import { PasswordResetView } from "@/modules/auth/ui/views/password-reset-view"

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <PasswordResetView />
    </Suspense>
  )
}
