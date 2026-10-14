import { createFileRoute, redirect } from "@tanstack/react-router"

import { onboardingHead } from "@/modules/auth/head"
import { loadSession, loadWorkspace } from "@/modules/auth/queries"
import { OnboardingView } from "@/modules/auth/ui/views/onboarding-view"

export const Route = createFileRoute("/_auth/onboarding")({
  head: () => onboardingHead(),
  beforeLoad: async ({ context, location }) => {
    const session = await loadSession(context.queryClient)
    if (!session) {
      throw redirect({
        to: "/login",
        search: { redirect: location.pathname },
      })
    }

    const workspace = await loadWorkspace(context.queryClient)
    if (workspace) {
      throw redirect({ to: "/inbox" })
    }
  },
  component: OnboardingPage,
})

function OnboardingPage() {
  return <OnboardingView />
}
