import { createFileRoute, redirect } from "@tanstack/react-router"

import { sessionQueryOptions } from "@/modules/auth/queries"
import { redirectSearchSchema } from "@/modules/auth/search"
import { SignUpView } from "@/modules/auth/ui/views/sign-up-view"

export const Route = createFileRoute("/_auth/sign-up")({
  validateSearch: redirectSearchSchema,
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(
      sessionQueryOptions()
    )
    if (session) {
      throw redirect({ to: "/inbox" })
    }
  },
  component: SignUpPage,
})

function SignUpPage() {
  return <SignUpView />
}
