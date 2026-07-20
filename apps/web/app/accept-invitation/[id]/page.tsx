import { requireUser } from "@/modules/auth/server/session"
import { AcceptInvitationView } from "@/modules/organization/ui/views/accept-invitation-view"

export default async function AcceptInvitationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  await requireUser(`/accept-invitation/${id}`)
  return <AcceptInvitationView invitationId={id} />
}
