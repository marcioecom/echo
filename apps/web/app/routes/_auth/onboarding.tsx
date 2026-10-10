import { createFileRoute, redirect } from "@tanstack/react-router"

import {
  sessionQueryOptions,
  workspaceQueryOptions,
} from "@/modules/auth/queries"
import { OnboardingView } from "@/modules/auth/ui/views/onboarding-view"

export const Route = createFileRoute("/_auth/onboarding")({
  beforeLoad: async ({ context, location }) => {
    const session = await context.queryClient.ensureQueryData(
      sessionQueryOptions()
    )
    if (!session) {
      throw redirect({
        to: "/login",
        search: { redirect: location.pathname },
      })
    }

    const workspace = await context.queryClient.ensureQueryData(
      workspaceQueryOptions()
    )
    if (workspace) {
      throw redirect({ to: "/inbox" })
    }
  },
  component: OnboardingPage,
})

function OnboardingPage() {
  return <OnboardingView />
}
