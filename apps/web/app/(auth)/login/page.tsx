import { Suspense } from "react"
import { redirect } from "next/navigation"

import { getSession } from "@/modules/auth/server/session"
import { LoginView } from "@/modules/auth/ui/views/login-view"

export default async function LoginPage() {
  const session = await getSession()
  if (session) {
    redirect("/")
  }
  return (
    <Suspense>
      <LoginView />
    </Suspense>
  )
}
