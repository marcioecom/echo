import { createFileRoute, redirect } from "@tanstack/react-router"

import { loginHead } from "@/modules/auth/head"
import { sessionQueryOptions } from "@/modules/auth/queries"
import { redirectSearchSchema } from "@/modules/auth/search"
import { LoginView } from "@/modules/auth/ui/views/login-view"

export const Route = createFileRoute("/_auth/login")({
  validateSearch: redirectSearchSchema,
  head: () => loginHead(),
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(
      sessionQueryOptions()
    )
    if (session) {
      throw redirect({ to: "/inbox" })
    }
  },
  component: LoginPage,
})

function LoginPage() {
  return <LoginView />
}
