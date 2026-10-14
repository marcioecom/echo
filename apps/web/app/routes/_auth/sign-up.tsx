import { createFileRoute, redirect } from "@tanstack/react-router"

import { signUpHead } from "@/modules/auth/head"
import { loadSession } from "@/modules/auth/queries"
import { redirectSearchSchema } from "@/modules/auth/search"
import { SignUpView } from "@/modules/auth/ui/views/sign-up-view"

export const Route = createFileRoute("/_auth/sign-up")({
  validateSearch: redirectSearchSchema,
  head: () => signUpHead(),
  beforeLoad: async ({ context }) => {
    const session = await loadSession(context.queryClient)
    if (session) {
      throw redirect({ to: "/inbox" })
    }
  },
  component: SignUpPage,
})

function SignUpPage() {
  return <SignUpView />
}
