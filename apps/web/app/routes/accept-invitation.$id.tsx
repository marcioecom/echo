import { createFileRoute, redirect } from "@tanstack/react-router"

import { sessionQueryOptions } from "@/modules/auth/queries"
import { acceptInvitationHead } from "@/modules/organization/head"
import { AcceptInvitationView } from "@/modules/organization/ui/views/accept-invitation-view"

export const Route = createFileRoute("/accept-invitation/$id")({
  ssr: false,
  head: () => acceptInvitationHead(),
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
  },
  component: AcceptInvitationPage,
})

function AcceptInvitationPage() {
  const { id } = Route.useParams()
  return <AcceptInvitationView invitationId={id} />
}
