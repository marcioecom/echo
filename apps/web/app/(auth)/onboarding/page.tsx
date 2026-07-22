import { redirect } from "next/navigation"

import { getWorkspace, requireUser } from "@/modules/auth/server/session"
import { OnboardingView } from "@/modules/auth/ui/views/onboarding-view"

export default async function OnboardingPage() {
  await requireUser("/onboarding")
  const workspace = await getWorkspace()
  if (workspace) {
    redirect("/")
  }
  return <OnboardingView />
}
