import { redirect } from "next/navigation"
import { Suspense } from "react"

import { getSession } from "@/modules/auth/server/session"
import { SignUpView } from "@/modules/auth/ui/views/sign-up-view"

export default async function SignUpPage() {
  const session = await getSession()
  if (session) {
    redirect("/")
  }
  return (
    <Suspense>
      <SignUpView />
    </Suspense>
  )
}
